"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { createDocumentWithNumber } from "@/lib/documents-core";
import { buildingAccount } from "@/lib/owner-account";
import { commissionForBuilding } from "@/lib/commission";
import { buildingCommissionAccount } from "@/lib/commission-standing";
import { formatCurrency } from "@/lib/format";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const remittanceSchema = z.object({
  buildingId: z.string().min(1, "المبنى مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  remittedAt: z.string().min(1, "تاريخ التحويل مطلوب"),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Records money actually transferred to the owner and issues the voucher evidencing it.
 * Remittances are per building so each property's account shows what was paid out of it.
 */
export async function createRemittance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("remittances.create");

  const parsed = remittanceSchema.safeParse({
    buildingId: String(formData.get("buildingId") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    remittedAt: String(formData.get("remittedAt") ?? ""),
    method: String(formData.get("method") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const building = await prisma.building.findUnique({
    where: { id: d.buildingId },
    select: { id: true, ownerId: true },
  });
  if (!building) return { error: "المبنى غير موجود" };

  const remittedAt = new Date(d.remittedAt);
  if (Number.isNaN(remittedAt.getTime())) return { error: "تاريخ التحويل غير صحيح" };

  // Each property carries its own account and its own transfer. A remittance beyond what
  // this one owes is nearly always a lump sum meant for several properties, so it is
  // refused unless whoever records it says otherwise.
  if (formData.get("acknowledge") !== "on") {
    const terms = await commissionForBuilding(building.id);
    const account = await buildingAccount(building.id, "", { from: new Date(0), to: new Date() }, terms?.percent ?? 0);
    if (d.amount > account.balance + 0.5) {
      return {
        error: `المبلغ يتجاوز مستحق هذا العقار (${formatCurrency(account.balance)}). سجّل لكل عقار سنده على حدة، أو أكّد المتابعة.`,
        needsAcknowledge: true,
      };
    }
  }

  const remittance = await prisma.ownerRemittance.create({
    data: {
      buildingId: building.id,
      ownerId: building.ownerId,
      amount: d.amount,
      remittedAt,
      method: d.method || null,
      reference: d.reference || null,
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  const doc = await createDocumentWithNumber("OWNER_REMITTANCE", {
    status: "ISSUED",
    amount: d.amount,
    issueDate: remittedAt,
    remittanceId: remittance.id,
    issuedById: user.id,
  });

  // Settling the fee out of the transfer is the ordinary way it is paid, and it leaves no trace
  // of its own unless one is made: the operator simply keeps it. So a deduction earns the same
  // voucher a payment would, and the owner sees on the paper he signs what was held back.
  let feeDoc: { documentNumber: string; amount: number } | null = null;
  if (formData.get("deductFee") === "on") {
    const account = await buildingCommissionAccount(building.id);
    if (account.unsettled > 0.5) {
      const fee = await prisma.commissionCollection.create({
        data: {
          buildingId: building.id,
          ownerId: building.ownerId,
          amount: account.unsettled,
          collectedAt: remittedAt,
          method: "خصم من التوريد",
          reference: doc.documentNumber,
          notes: `خُصمت من التوريد ${doc.documentNumber}`,
          createdById: user.id,
        },
      });
      const issued = await createDocumentWithNumber("COMMISSION_RECEIPT", {
        status: "ISSUED",
        amount: account.unsettled,
        issueDate: remittedAt,
        commissionId: fee.id,
        issuedById: user.id,
      });
      feeDoc = { documentNumber: issued.documentNumber, amount: account.unsettled };
      await prisma.ownerRemittance.update({
        where: { id: remittance.id },
        data: {
          notes: [remittance.notes, `خُصمت أتعاب إدارة ${formatCurrency(account.unsettled)} بموجب السند ${issued.documentNumber}`]
            .filter(Boolean)
            .join(" — "),
        },
      });
    }
  }

  await recordAudit({
    user,
    action: "remittances.create",
    summary: `توريد ${d.amount} للمالك عن مبنى — سند ${doc.documentNumber}`,
    targetId: remittance.id,
  });

  revalidatePath("/documents");
  revalidatePath(`/owners/${building.ownerId}`);
  revalidatePath(`/buildings/${building.id}`);
  return {
    success: true,
    message: feeDoc
      ? `تم تسجيل التوريد (${doc.documentNumber}) وخصم أتعاب ${formatCurrency(feeDoc.amount)} بالسند ${feeDoc.documentNumber}`
      : `تم تسجيل التوريد وإصدار السند ${doc.documentNumber}`,
  };
}

/** Reverses a transfer entered by mistake; its voucher goes with it. */
/**
 * A remittance is undone by voiding its voucher: the document is stamped cancelled and the
 * amount returns to the owner's balance, so paperwork and money stay in step.
 */
export async function cancelRemittance(id: string, reason?: string): Promise<ActionState> {
  const doc = await prisma.financialDocument.findFirst({
    where: { remittanceId: id, type: "OWNER_REMITTANCE", status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (!doc) return { error: "سند التوريد غير موجود أو سبق إلغاؤه" };


  return runSensitive("documents.cancel", { id: doc.id, reason }, reason);
}
