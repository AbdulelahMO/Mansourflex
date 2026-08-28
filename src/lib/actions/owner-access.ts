"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/authz";
import { generateSimplePassword } from "@/lib/passwords";
import type { ActionState } from "@/lib/types";

/** The temporary password travels back to the screen once, so it is never parsed out of a message. */
export type OwnerAccessState = ActionState & { password?: string; username?: string };

/**
 * Not every owner wants to sign in, so the account is made only when one is asked for —
 * and only by the administrator. The password handed over is temporary: the owner replaces
 * it on first sign-in, after which nobody but the owner knows it.
 */

const PERMISSION = "owners.access";

async function loadOwner(id: string) {
  return prisma.owner.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, userId: true, user: { select: { email: true, isActive: true } } },
  });
}

function ownerPaths(id: string) {
  revalidatePath("/owners");
  revalidatePath(`/owners/${id}`);
}

export async function createOwnerLogin(ownerId: string): Promise<OwnerAccessState> {
  const admin = await requireAdmin();

  const owner = await loadOwner(ownerId);
  if (!owner) return { error: "المالك غير موجود" };
  if (owner.userId) return { error: "للمالك حساب دخول بالفعل" };

  const email = owner.email?.trim().toLowerCase();
  if (!email) return { error: "أضف البريد الإلكتروني للمالك أولاً — فهو اسم المستخدم" };

  const taken = await prisma.user.findUnique({ where: { email }, select: { name: true } });
  if (taken) return { error: `البريد مستخدم لحساب آخر (${taken.name})` };

  const temporary = generateSimplePassword();
  const user = await prisma.user.create({
    data: {
      name: owner.name,
      email,
      passwordHash: await bcrypt.hash(temporary, 10),
      mustChangePassword: true,
      role: "OWNER",
    },
  });
  await prisma.owner.update({ where: { id: ownerId }, data: { userId: user.id } });

  await recordAudit({
    user: admin,
    action: PERMISSION,
    summary: `إنشاء حساب دخول للمالك ${owner.name}`,
    targetType: "owner",
    targetId: ownerId,
  });
  ownerPaths(ownerId);
  return { success: true, username: email, password: temporary };
}

export async function resetOwnerPassword(ownerId: string): Promise<OwnerAccessState> {
  const admin = await requireAdmin();

  const owner = await loadOwner(ownerId);
  if (!owner?.userId) return { error: "لا يوجد حساب دخول لهذا المالك" };

  const temporary = generateSimplePassword();
  await prisma.user.update({
    where: { id: owner.userId },
    data: { passwordHash: await bcrypt.hash(temporary, 10), mustChangePassword: true },
  });

  await recordAudit({
    user: admin,
    action: PERMISSION,
    summary: `إعادة تعيين كلمة مرور المالك ${owner.name}`,
    targetType: "owner",
    targetId: ownerId,
  });
  ownerPaths(ownerId);
  return { success: true, username: owner.user?.email, password: temporary };
}

/** Suspends or restores access without discarding the account or its history. */
export async function setOwnerLoginActive(ownerId: string, active: boolean): Promise<ActionState> {
  const admin = await requireAdmin();

  const owner = await loadOwner(ownerId);
  if (!owner?.userId) return { error: "لا يوجد حساب دخول لهذا المالك" };

  await prisma.user.update({ where: { id: owner.userId }, data: { isActive: active } });

  await recordAudit({
    user: admin,
    action: PERMISSION,
    summary: `${active ? "تفعيل" : "إيقاف"} حساب دخول المالك ${owner.name}`,
    targetType: "owner",
    targetId: ownerId,
  });
  ownerPaths(ownerId);
  return { success: true, message: active ? "تم تفعيل الحساب" : "تم إيقاف الحساب" };
}

/** Removes the sign-in account; the owner's record and their properties stay untouched. */
export async function removeOwnerLogin(ownerId: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const owner = await loadOwner(ownerId);
  if (!owner?.userId) return { error: "لا يوجد حساب دخول لهذا المالك" };

  await prisma.user.delete({ where: { id: owner.userId } });

  await recordAudit({
    user: admin,
    action: PERMISSION,
    summary: `إلغاء حساب دخول المالك ${owner.name}`,
    targetType: "owner",
    targetId: ownerId,
  });
  ownerPaths(ownerId);
  return { success: true, message: "تم إلغاء حساب الدخول" };
}
