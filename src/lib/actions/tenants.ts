"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب"),
  tenantType: z.string().trim().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{10}$/.test(v), "رقم الجوال يجب أن يتكون من 10 أرقام"),
  email: z.string().trim().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  nationalId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{10}$/.test(v), "رقم الهوية يجب أن يتكون من 10 أرقام"),
  commercialRegister: z.string().trim().optional().or(z.literal("")),
  unifiedNumber: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^700\d{7}$/.test(v), "الرقم الموحد يجب أن يبدأ بـ700 ويتكون من 10 أرقام"),
  representativeName: z.string().trim().optional().or(z.literal("")),
  representativeNationalId: z.string().trim().optional().or(z.literal("")),
  representativePhone: z.string().trim().optional().or(z.literal("")),
  representativeEmail: z.string().trim().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

async function createTenantRecord(formData: FormData) {
  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, state: { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors } } as const;
  }
  const data = parsed.data;

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      tenantType: data.tenantType || null,
      phone: data.phone || null,
      email: data.email || null,
      nationalId: data.nationalId || null,
      commercialRegister: data.commercialRegister || null,
      unifiedNumber: data.unifiedNumber || null,
      representativeName: data.representativeName || null,
      representativeNationalId: data.representativeNationalId || null,
      representativePhone: data.representativePhone || null,
      representativeEmail: data.representativeEmail || null,
      notes: data.notes || null,
    },
  });

  return { ok: true as const, tenant };
}

export async function createTenant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("tenants.create");

  const result = await createTenantRecord(formData);
  if (!result.ok) return result.state;

  revalidatePath("/tenants");
  redirect("/tenants");
}

export type TenantActionState = ActionState & { tenant?: { id: string; name: string } };

/** Same as createTenant but returns the created tenant instead of redirecting, for inline "add tenant" dialogs. */
export async function createTenantInline(_prev: TenantActionState, formData: FormData): Promise<TenantActionState> {
  await requirePermission("tenants.create");

  const result = await createTenantRecord(formData);
  if (!result.ok) return result.state;

  return { success: true, tenant: { id: result.tenant.id, name: result.tenant.name } };
}

export async function updateTenant(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("tenants.edit");

  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  await prisma.tenant.update({
    where: { id },
    data: {
      name: data.name,
      tenantType: data.tenantType || null,
      phone: data.phone || null,
      email: data.email || null,
      nationalId: data.nationalId || null,
      commercialRegister: data.commercialRegister || null,
      unifiedNumber: data.unifiedNumber || null,
      representativeName: data.representativeName || null,
      representativeNationalId: data.representativeNationalId || null,
      representativePhone: data.representativePhone || null,
      representativeEmail: data.representativeEmail || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function deleteTenant(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("tenants.delete", { id }, reason);
}
