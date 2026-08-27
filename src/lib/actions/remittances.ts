"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { createDocumentWithNumber } from "@/lib/documents-core";
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

  await recordAudit({
    user,
    action: "remittances.create",
    summary: `توريد ${d.amount} للمالك عن مبنى — سند ${doc.documentNumber}`,
    targetId: remittance.id,
  });

  revalidatePath("/documents");
  revalidatePath(`/owners/${building.ownerId}`);
  revalidatePath(`/buildings/${building.id}`);
  return { success: true, message: `تم تسجيل التوريد وإصدار السند ${doc.documentNumber}` };
}

/** Reverses a transfer entered by mistake; its voucher goes with it. */
export async function deleteRemittance(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("remittances.delete", { id }, reason);
}
