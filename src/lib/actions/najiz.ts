"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import type { ActionState } from "@/lib/types";

export async function referPaymentToNajiz(paymentId: string): Promise<ActionState> {
  await requirePermission("payments.edit");

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "الدفعة غير موجودة" };

  await prisma.payment.update({ where: { id: paymentId }, data: { najizReferredAt: new Date() } });

  revalidatePath(`/contracts/${payment.contractId}`);
  return { success: true, message: "تم تحويل الدفعة إلى ناجز" };
}

export async function cancelNajizReferral(paymentId: string): Promise<ActionState> {
  await requirePermission("payments.edit");

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "الدفعة غير موجودة" };

  await prisma.payment.update({ where: { id: paymentId }, data: { najizReferredAt: null } });

  revalidatePath(`/contracts/${payment.contractId}`);
  return { success: true, message: "تم إلغاء إحالة الدفعة" };
}
