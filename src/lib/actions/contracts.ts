"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const contractSchema = z.object({
  ejarContractNumber: z.string().trim().optional().or(z.literal("")),
  unitId: z.string().trim().min(1, "اختر الوحدة"),
  tenantId: z.string().trim().min(1, "اختر المستأجر"),
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().trim().min(1, "تاريخ النهاية مطلوب"),
  rentAmount: z.string().trim().min(1, "قيمة العقد مطلوبة"),
  amountType: z.enum(["TOTAL", "ANNUAL", "INCREASING"]),
  increasePercent: z.string().trim().optional().or(z.literal("")),
  vatRate: z.enum(["0", "5", "10", "15"]),
  depositAmount: z.string().trim().optional().or(z.literal("")),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "ONE_TIME"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Contract numbers are issued by the system, not typed in: derived from the highest number
 * already used this year so deleting a contract never makes the next one collide.
 */
async function nextContractNumber() {
  const year = new Date().getFullYear();
  const scope = `C-${year}-`;
  const issued = await prisma.contract.findMany({
    where: { contractNumber: { startsWith: scope } },
    select: { contractNumber: true },
  });
  const highest = issued.reduce((max, c) => {
    const seq = Number(c.contractNumber.slice(scope.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${scope}${String(highest + 1).padStart(4, "0")}`;
}

export async function createContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("contracts.create");

  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  }
  const rentAmount = Number(data.rentAmount);
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
    return { error: "قيمة العقد غير صحيحة" };
  }
  const increasePercent = data.increasePercent ? Number(data.increasePercent) : 0;
  if (data.amountType === "INCREASING" && (!Number.isFinite(increasePercent) || increasePercent <= 0)) {
    return { error: "أدخل نسبة الزيادة السنوية" };
  }

  const vatRate = Number(data.vatRate);
  const schedule = buildPaymentSchedule(startDate, endDate, rentAmount, data.paymentFrequency, data.amountType, increasePercent, vatRate);

  const created = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        contractNumber: await nextContractNumber(),
        createdById: user.id,
        ejarContractNumber: data.ejarContractNumber || null,
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate,
        endDate,
        rentAmount,
        amountType: data.amountType,
        increasePercent: data.amountType === "INCREASING" ? increasePercent : null,
        vatRate,
        depositAmount: data.depositAmount ? Number(data.depositAmount) : null,
        paymentFrequency: data.paymentFrequency,
        notes: data.notes || null,
        status: "ACTIVE",
        payments: { create: schedule.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    });

    await tx.unit.update({ where: { id: data.unitId }, data: { status: "OCCUPIED" } });

    return contract;
  });

  await recordAudit({ user, action: "contracts.create", summary: `إنشاء عقد ${created.contractNumber}`, targetId: created.id });

  revalidatePath("/contracts");
  revalidatePath("/units");
  revalidatePath("/payments");
  redirect("/contracts");
}

export async function updateContractStatus(id: string, status: "ACTIVE" | "EXPIRED" | "TERMINATED"): Promise<ActionState> {
  await requirePermission("contracts.edit");

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return { error: "العقد غير موجود" };

  await prisma.contract.update({ where: { id }, data: { status } });

  if (status !== "ACTIVE") {
    await prisma.unit.update({ where: { id: contract.unitId }, data: { status: "VACANT" } });
  }

  revalidatePath("/contracts");
  revalidatePath("/units");
  return { success: true };
}

export async function deleteContract(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("contracts.delete", { id }, reason);
}



/**
 * Renews as a fresh contract for the same unit and tenant: its own number, term, rent and
 * schedule, linked back to the contract it replaces so the history stays traceable.
 */
export async function renewContract(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contracts.renew");

  const { user } = await requirePermission("contracts.renew");
  const previous = await prisma.contract.findUnique({ where: { id }, include: { renewedTo: true } });
  if (!previous) return { error: "العقد غير موجود" };
  if (previous.status === "TERMINATED") return { error: "لا يمكن تجديد عقد مفسوخ" };
  if (previous.renewedTo) return { error: `سبق تجديد هذا العقد (${previous.renewedTo.contractNumber})` };

  const startDate = new Date(String(formData.get("startDate") ?? ""));
  const endDate = new Date(String(formData.get("endDate") ?? ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { error: "تواريخ العقد غير صحيحة" };
  if (endDate <= startDate) return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };

  const rentAmount = Number(formData.get("rentAmount") ?? 0);
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) return { error: "قيمة الإيجار غير صحيحة" };

  const increasePercent = previous.amountType === "INCREASING" ? previous.increasePercent ?? 0 : 0;
  const schedule = buildPaymentSchedule(
    startDate,
    endDate,
    rentAmount,
    previous.paymentFrequency,
    previous.amountType as "TOTAL" | "ANNUAL" | "INCREASING",
    increasePercent,
    previous.vatRate
  );
  if (schedule.length === 0) return { error: "تعذر توليد جدول الدفعات — راجع التواريخ" };

  const created = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        contractNumber: await nextContractNumber(),
        createdById: user.id,
        ejarContractNumber: String(formData.get("ejarContractNumber") ?? "").trim() || null,
        unitId: previous.unitId,
        tenantId: previous.tenantId,
        startDate,
        endDate,
        rentAmount,
        amountType: previous.amountType,
        increasePercent: previous.amountType === "INCREASING" ? increasePercent : null,
        vatRate: previous.vatRate,
        depositAmount: previous.depositAmount,
        paymentFrequency: previous.paymentFrequency,
        notes: String(formData.get("notes") ?? "").trim() || null,
        status: "ACTIVE",
        renewedFromId: previous.id,
        payments: { create: schedule.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    });

    // The old contract has been replaced; it is finished whatever its previous state was.
    await tx.contract.update({ where: { id: previous.id }, data: { status: "EXPIRED" } });
    await tx.unit.update({ where: { id: previous.unitId }, data: { status: "OCCUPIED" } });

    return contract;
  });

  await recordAudit({
    user,
    action: "contracts.renew",
    summary: `تجديد العقد ${previous.contractNumber} بعقد جديد ${created.contractNumber}`,
    targetId: created.id,
  });

  revalidatePath("/contracts");
  revalidatePath("/payments");
  redirect(`/contracts/${created.id}`);
}
