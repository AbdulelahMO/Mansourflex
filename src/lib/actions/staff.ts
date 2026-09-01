"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/authz";
import { decideApproval } from "@/lib/approvals";
import { ALL_PERMISSIONS, ALWAYS_ADMIN_ONLY } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/passwords";
import type { ActionState } from "@/lib/types";

const VALID_KEYS = new Set(ALL_PERMISSIONS.map((p) => p.key));
const STATES = ["ALLOW", "APPROVE", "DENY"] as const;
type State = (typeof STATES)[number];

function parseState(value: FormDataEntryValue | null): State | null {
  const v = String(value ?? "");
  return (STATES as readonly string[]).includes(v) ? (v as State) : null;
}

const employeeSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
  staffRoleId: z.string().trim().min(1, "اختر الدور"),
  isActive: z.boolean(),
});

const ID_PATTERN = /^\d{10}$/;
const PHONE_PATTERN = /^05\d{8}$/;

/**
 * Identity is required for a new employee — it ties every logged action to a real person —
 * but is only validated when supplied on an edit, so accounts created earlier keep working.
 */
async function identityError(
  nationalId: string,
  phone: string,
  { required, ignoreUserId }: { required: boolean; ignoreUserId?: string }
) {
  if (required || nationalId) {
    if (!ID_PATTERN.test(nationalId)) return "رقم الهوية يتكوّن من 10 أرقام";
    const taken = await prisma.user.findFirst({
      where: { nationalId, ...(ignoreUserId ? { id: { not: ignoreUserId } } : {}) },
      select: { name: true },
    });
    if (taken) return `رقم الهوية مسجّل باسم ${taken.name}`;
  }
  if (required || phone) {
    if (!PHONE_PATTERN.test(phone)) return "رقم الجوال يبدأ بـ05 ويتكوّن من 10 أرقام";
  }
  return null;
}

export async function createEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = employeeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    staffRoleId: String(formData.get("staffRoleId") ?? ""),
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const identity = await identityError(nationalId, phone, { required: true });
  if (identity) return { error: identity };

  const taken = await prisma.user.findUnique({ where: { email: d.email } });
  if (taken) return { error: "البريد الإلكتروني مستخدم مسبقاً" };

  // Generated, never chosen by the admin — and replaced by the employee on first sign-in,
  // so the working password is known to its holder alone.
  const temporary = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      nationalId,
      phone,
      passwordHash: await bcrypt.hash(temporary, 10),
      mustChangePassword: true,
      role: "EMPLOYEE",
      staffRoleId: d.staffRoleId,
      isActive: d.isActive,
    },
  });

  await recordAudit({ user: admin, action: "staff.manage", summary: `إضافة موظف: ${d.name}`, targetId: user.id });
  revalidatePath("/settings/employees");
  return {
    success: true,
    message: `تمت إضافة الموظف. كلمة المرور المؤقتة: ${temporary} — سلّمها له، ولن تظهر مرة أخرى.`,
  };
}

export async function updateEmployee(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = employeeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    staffRoleId: String(formData.get("staffRoleId") ?? ""),
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "EMPLOYEE") return { error: "الموظف غير موجود" };

  const taken = await prisma.user.findFirst({ where: { email: d.email, id: { not: id } } });
  if (taken) return { error: "البريد الإلكتروني مستخدم مسبقاً" };

  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const identity = await identityError(nationalId, phone, { required: false, ignoreUserId: id });
  if (identity) return { error: identity };

  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email,
      // Left as they are when the field is submitted empty on an older account.
      nationalId: nationalId || null,
      phone: phone || null,
      staffRoleId: d.staffRoleId,
      isActive: d.isActive,
    },
  });

  await recordAudit({ user: admin, action: "staff.manage", summary: `تعديل بيانات الموظف: ${d.name}`, targetId: id });
  revalidatePath("/settings/employees");
  return { success: true, message: "تم حفظ التعديلات" };
}

/** For a forgotten password: a fresh temporary one, shown to the admin once and forced to change. */
export async function resetEmployeePassword(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true } });
  if (!target || target.role !== "EMPLOYEE") return { error: "الموظف غير موجود" };

  const temporary = generateTemporaryPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(temporary, 10), mustChangePassword: true },
  });

  await recordAudit({
    user: admin,
    action: "staff.manage",
    summary: `إعادة تعيين كلمة مرور الموظف ${target.name}`,
    targetId: id,
  });
  revalidatePath("/settings/employees");
  return {
    success: true,
    message: `كلمة المرور المؤقتة لـ${target.name}: ${temporary} — سلّمها له، ولن تظهر مرة أخرى.`,
  };
}

export async function deleteEmployee(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true } });
  if (!target || target.role !== "EMPLOYEE") return { error: "الموظف غير موجود" };

  await prisma.user.delete({ where: { id } });
  await recordAudit({ user: admin, action: "staff.manage", summary: `حذف الموظف: ${target.name}`, targetId: id });
  revalidatePath("/settings/employees");
  return { success: true };
}

/** Individual exception over the role — a single permission granted or withdrawn for one employee. */
export async function setUserPermission(
  userId: string,
  key: string,
  state: string | null
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!VALID_KEYS.has(key)) return { error: "صلاحية غير معروفة" };
  if (ALWAYS_ADMIN_ONLY.has(key)) return { error: "هذه الصلاحية لا تُمنح لأحد غير مدير النظام" };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!target || target.role !== "EMPLOYEE") return { error: "الموظف غير موجود" };

  if (state === null) {
    // Back to whatever the role says.
    await prisma.userPermission.deleteMany({ where: { userId, key } });
  } else {
    const parsed = parseState(state);
    if (!parsed) return { error: "حالة غير صحيحة" };
    await prisma.userPermission.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, state: parsed },
      update: { state: parsed },
    });
  }

  await recordAudit({
    user: admin,
    action: "staff.manage",
    summary: `تعديل استثناء «${key}» للموظف ${target.name}`,
    targetId: userId,
  });
  revalidatePath(`/settings/employees/${userId}`);
  return { success: true, message: "تم حفظ الاستثناء" };
}

const roleSchema = z.object({
  name: z.string().trim().min(1, "اسم الدور مطلوب"),
  description: z.string().trim().optional(),
  inheritsAll: z.boolean(),
});

export async function createRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    inheritsAll: formData.get("inheritsAll") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const taken = await prisma.staffRole.findUnique({ where: { name: d.name } });
  if (taken) return { error: "اسم الدور مستخدم مسبقاً" };

  const role = await prisma.staffRole.create({
    data: { name: d.name, description: d.description || null, inheritsAll: d.inheritsAll },
  });

  await recordAudit({ user: admin, action: "staff.manage", summary: `إنشاء دور: ${d.name}`, targetId: role.id });
  revalidatePath("/settings/employees");
  return { success: true, message: "تم إنشاء الدور" };
}

export async function updateRole(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    inheritsAll: formData.get("inheritsAll") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const taken = await prisma.staffRole.findFirst({ where: { name: d.name, id: { not: id } } });
  if (taken) return { error: "اسم الدور مستخدم مسبقاً" };

  await prisma.staffRole.update({
    where: { id },
    data: { name: d.name, description: d.description || null, inheritsAll: d.inheritsAll },
  });

  await recordAudit({ user: admin, action: "staff.manage", summary: `تعديل الدور: ${d.name}`, targetId: id });
  revalidatePath("/settings/employees");
  revalidatePath(`/settings/roles/${id}`);
  return { success: true, message: "تم حفظ الدور" };
}

/** Saves the whole permission matrix of a role in one submit. */
export async function saveRolePermissions(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const role = await prisma.staffRole.findUnique({ where: { id } });
  if (!role) return { error: "الدور غير موجود" };

  const rows: { key: string; state: State }[] = [];
  for (const p of ALL_PERMISSIONS) {
    if (ALWAYS_ADMIN_ONLY.has(p.key)) continue; // never delegable, never stored
    const state = parseState(formData.get(`perm:${p.key}`));
    if (state) rows.push({ key: p.key, state });
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({ data: rows.map((r) => ({ ...r, roleId: id })) }),
  ]);

  await recordAudit({ user: admin, action: "staff.manage", summary: `تعديل صلاحيات الدور: ${role.name}`, targetId: id });
  revalidatePath("/settings/employees");
  revalidatePath(`/settings/roles/${id}`);
  return { success: true, message: "تم حفظ الصلاحيات" };
}

export async function deleteRole(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const role = await prisma.staffRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) return { error: "الدور غير موجود" };
  if (role.isSystem) return { error: "لا يمكن حذف دور معرّف مع النظام — عدّل صلاحياته بدل حذفه" };
  if (role._count.users > 0) return { error: `لا يمكن حذف دور مسند إلى ${role._count.users} موظف` };

  await prisma.staffRole.delete({ where: { id } });
  await recordAudit({ user: admin, action: "staff.manage", summary: `حذف الدور: ${role.name}`, targetId: id });
  revalidatePath("/settings/employees");
  return { success: true };
}

export async function approveRequest(id: string, note?: string): Promise<ActionState> {
  return decideApproval(id, true, note);
}

export async function rejectRequest(id: string, note?: string): Promise<ActionState> {
  return decideApproval(id, false, note);
}

/* ————————————————— المديرون —————————————————
 *
 * An administrator has nobody above them: no role restrains what they may do, no approval is
 * asked of them, and nothing they do is held back for review. So the account is not created
 * lightly — but it must be creatable from inside the system, or the only way to make one is a
 * command on the server, which is exactly the dependence the system should spare its owner.
 */

const adminSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
});

export async function createAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = adminSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = { ...parsed.data, email: parsed.data.email.toLowerCase() };

  const taken = await prisma.user.findUnique({ where: { email: d.email } });
  if (taken) return { error: "البريد الإلكتروني مستخدم مسبقاً" };

  const phone = String(formData.get("phone") ?? "").trim();
  const temporary = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      phone: phone || null,
      passwordHash: await bcrypt.hash(temporary, 10),
      mustChangePassword: true,
      role: "ADMIN",
    },
  });

  await recordAudit({
    user: admin,
    action: "staff.manage",
    summary: `إضافة مدير نظام: ${d.name} (${d.email})`,
    targetId: user.id,
  });
  revalidatePath("/settings/employees");
  return {
    success: true,
    message: `أُضيف المدير. كلمة المرور المؤقتة: ${temporary} — سلّمها له، ولن تظهر مرة أخرى.`,
  };
}

/** For a forgotten password, and it lifts the sign-in lock that the forgetting earned. */
export async function resetAdminPassword(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
  if (!target || target.role !== "ADMIN") return { error: "الحساب غير موجود أو ليس حساب مدير" };

  const temporary = generateTemporaryPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(temporary, 10), mustChangePassword: true },
  });
  // The failures that piled up were against a password that no longer exists; making its owner
  // wait out a lock earned by a password they no longer have is a punishment for nothing.
  await prisma.loginAttempt.deleteMany({ where: { email: target.email } });

  await recordAudit({
    user: admin,
    action: "staff.manage",
    summary: `إعادة تعيين كلمة مرور المدير ${target.name}`,
    targetId: id,
  });
  revalidatePath("/settings/employees");
  return {
    success: true,
    message: `كلمة المرور المؤقتة لـ${target.name}: ${temporary} — سلّمها له، ولن تظهر مرة أخرى.`,
  };
}

/**
 * Stopping an administrator's account — the way an old one is closed once nobody holds its
 * password any more. Deleting is not offered: an admin's name sits on contracts, receipts and
 * the audit log, and those must keep naming somebody.
 */
export async function setAdminActive(id: string, isActive: boolean): Promise<ActionState> {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true, isActive: true } });
  if (!target || target.role !== "ADMIN") return { error: "الحساب غير موجود أو ليس حساب مدير" };
  if (id === admin.id) return { error: "لا يمكنك إيقاف حسابك أنت" };

  if (!isActive) {
    // The system must never be left without a way in.
    const others = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
    if (others === 0) return { error: "لا يمكن إيقاف آخر مدير نشط في النظام" };
  }

  await prisma.user.update({ where: { id }, data: { isActive } });

  await recordAudit({
    user: admin,
    action: "staff.manage",
    summary: `${isActive ? "تفعيل" : "إيقاف"} حساب المدير ${target.name}`,
    targetId: id,
  });
  revalidatePath("/settings/employees");
  return { success: true, message: isActive ? "فُعّل الحساب" : "أُوقف الحساب — لن يستطيع الدخول" };
}
