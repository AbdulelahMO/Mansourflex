import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { sensitiveOp } from "@/lib/core/sensitive-ops";
import type { ActionState } from "@/lib/types";

/** A pending request older than this is dropped, so nobody approves forgotten context. */
export const APPROVAL_WINDOW_DAYS = 7;

/**
 * Single entry point for every action a role may hold as "يحتاج موافقة".
 * Runs it outright when the permission allows, and otherwise files a request carrying the
 * exact payload so approving it performs the same act that was asked for.
 */
export async function runSensitive(
  action: string,
  payload: Record<string, unknown>,
  reason?: string
): Promise<ActionState> {
  const op = sensitiveOp(action);
  if (!op) return { error: "إجراء غير معروف" };

  const { user, needsApproval } = await requirePermission(op.permission);
  const summary = await op.describe(payload);

  if (needsApproval) {
    const text = (reason ?? "").trim();
    if (!text) {
      return {
        error: `«${summary}» يحتاج موافقة مدير النظام — اكتب سبب الطلب`,
        needsReason: true,
      };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + APPROVAL_WINDOW_DAYS);

    await prisma.approvalRequest.create({
      data: { action, payload: JSON.stringify(payload), summary, reason: text, requestedById: user.id, expiresAt },
    });

    revalidatePath("/approvals");
    return { success: true, message: "أُرسل الطلب إلى مدير النظام، وسيُنفَّذ فور الموافقة عليه" };
  }

  const result = await op.run(payload);
  if (result.success) {
    await recordAudit({ user, action: op.permission, summary, targetId: String(payload.id ?? "") });
  }
  return result;
}

/** Marks anything past its window as expired before the list is read or decided on. */
export async function expireStaleApprovals() {
  await prisma.approvalRequest.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

/**
 * Approving executes the stored action now — the requester never has to retry. The operation
 * re-checks its own rules, so a request that became invalid while waiting fails loudly
 * instead of forcing through a state the system would otherwise refuse.
 */
export async function decideApproval(id: string, approve: boolean, note?: string): Promise<ActionState> {
  const { user } = await requirePermission("approvals.decide");
  await expireStaleApprovals();

  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) return { error: "الطلب غير موجود" };
  if (request.status !== "PENDING") return { error: "سبق البتّ في هذا الطلب" };

  const decision = { decidedById: user.id, decidedAt: new Date(), decisionNote: note?.trim() || null };

  if (!approve) {
    await prisma.approvalRequest.update({ where: { id }, data: { ...decision, status: "REJECTED" } });
    await recordAudit({ user, action: "approvals.decide", summary: `رفض طلب: ${request.summary}`, approvalId: id });
    revalidatePath("/approvals");
    return { success: true, message: "تم رفض الطلب" };
  }

  const op = sensitiveOp(request.action);
  if (!op) return { error: "إجراء غير معروف" };

  const result = await op.run(JSON.parse(request.payload));

  if (result.error) {
    await prisma.approvalRequest.update({ where: { id }, data: { ...decision, status: "FAILED", error: result.error } });
    revalidatePath("/approvals");
    return { error: `تعذّر تنفيذ الطلب بعد الموافقة: ${result.error}` };
  }

  await prisma.approvalRequest.update({ where: { id }, data: { ...decision, status: "APPROVED" } });
  await recordAudit({
    user,
    action: op.permission,
    summary: `${request.summary} — بموافقة على طلب`,
    approvalId: id,
  });

  revalidatePath("/approvals");
  return { success: true, message: "تمت الموافقة وتنفيذ الطلب" };
}

export async function pendingApprovalCount() {
  await expireStaleApprovals();
  return prisma.approvalRequest.count({ where: { status: "PENDING" } });
}
