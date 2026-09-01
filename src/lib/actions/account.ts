"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { recordAudit } from "@/lib/authz";
import { passwordError } from "@/lib/passwords";
import type { ActionState } from "@/lib/types";

/**
 * Anyone changing their own password — the only path by which a working password is set,
 * so it stays known to its holder alone. Proving the current one blocks a walk-up takeover
 * of an unattended session.
 */
export async function changeOwnPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const account = await prisma.user.findUnique({ where: { id: session.id } });
  if (!account) return { error: "الحساب غير موجود" };

  if (!(await bcrypt.compare(current, account.passwordHash))) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }

  const invalid = passwordError(next, account.email);
  if (invalid) return { error: invalid };
  if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين" };
  if (await bcrypt.compare(next, account.passwordHash)) {
    return { error: "اختر كلمة مرور مختلفة عن الحالية" };
  }

  await prisma.user.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false },
  });

  await recordAudit({
    user: session,
    action: "account.password",
    summary: "تغيير كلمة المرور الشخصية",
    targetId: account.id,
  });

  revalidatePath("/account");
  return { success: true, message: "تم تغيير كلمة المرور" };
}
