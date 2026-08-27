"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/session";
import { generateNotifications } from "@/lib/notifications";
import { syncOverduePayments } from "@/lib/actions/payments";
import type { ActionState } from "@/lib/types";

export async function runNotificationScan(): Promise<ActionState> {
  await requireAdmin();
  await syncOverduePayments();
  const { created } = await generateNotifications();
  revalidatePath("/notifications");
  return { success: true, message: created === 0 ? "لا توجد إشعارات جديدة" : `تم إنشاء ${created} إشعار جديد` };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.update({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
