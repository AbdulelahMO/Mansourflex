"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { createDocumentWithNumber } from "@/lib/documents-core";
import { formatCurrency } from "@/lib/format";
import { runSensitive } from "@/lib/approvals";
import { buildingCommissionAccount } from "@/lib/commission-standing";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  buildingId: z.string().min(1, "المبنى مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  collectedAt: z.string().min(1, "تاريخ الاستلام مطلوب"),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Records management fees received from the owner, and issues the voucher that proves it.
 *
 * Kept per property, like the remittance it mirrors: the fee is owed under one property's
 * agreement at one property's rate, and «قبضنا منك مبلغاً» with no property named settles nothing.
 */
export async function createCommissionCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("remittances.create");

  const parsed = schema.safeParse({
    buildingId: String(formData.get("buildingId") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    collectedAt: String(formData.get("collectedAt") ?? ""),
    method: String(formData.get("method") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const building = await prisma.building.findUnique({
    where: { id: d.buildingId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!building) return { error: "المبنى غير موجود" };

  const collectedAt = new Date(d.collectedAt);
  if (Number.isNaN(collectedAt.getTime())) return { error: "تاريخ الاستلام غير صحيح" };

  // Receiving more than is owed means the figure came from somewhere other than this account —
  // another property, or an amount already settled by keeping it out of a transfer.
  if (formData.get("acknowledge") !== "on") {
    const account = await buildingCommissionAccount(building.id);
    if (d.amount > account.unsettled + 0.5) {
      return {
        error: `المبلغ يتجاوز الأتعاب غير المسوّاة عن هذا العقار (${formatCurrency(account.unsettled)}). راجعه، أو أكّد المتابعة.`,
        needsAcknowledge: true,
      };
    }
  }

  const collection = await prisma.commissionCollection.create({
    data: {
      buildingId: building.id,
      ownerId: building.ownerId,
      amount: d.amount,
      collectedAt,
      method: d.method || null,
      reference: d.reference || null,
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  const doc = await createDocumentWithNumber("COMMISSION_RECEIPT", {
    status: "ISSUED",
    amount: d.amount,
    issueDate: collectedAt,
    commissionId: collection.id,
    issuedById: user.id,
  });

  await recordAudit({
    user,
    action: "remittances.create",
    summary: `قبض أتعاب إدارة ${formatCurrency(d.amount)} عن ${building.name} — سند ${doc.documentNumber}`,
    targetId: collection.id,
  });

  revalidatePath("/documents");
  revalidatePath(`/owners/${building.ownerId}`);
  revalidatePath(`/owners/${building.ownerId}/statement`);
  revalidatePath(`/buildings/${building.id}`);
  return { success: true, message: `سُجّل قبض الأتعاب وصدر السند ${doc.documentNumber}` };
}

/** Undone the way every document is: the voucher is voided and the fee returns to being owed. */
export async function cancelCommissionCollection(id: string, reason?: string): Promise<ActionState> {
  const doc = await prisma.financialDocument.findFirst({
    where: { commissionId: id, type: "COMMISSION_RECEIPT", status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (!doc) return { error: "سند قبض العمولة غير موجود أو سبق إلغاؤه" };

  return runSensitive("documents.cancel", { id: doc.id, reason }, reason);
}
