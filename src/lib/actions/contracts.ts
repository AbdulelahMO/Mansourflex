"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { round2, issueReceiptForPayment } from "@/lib/documents-core";
import { allocate } from "@/lib/allocation";
import { formatCurrency } from "@/lib/format";
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

/** Contract fields that carry no consequence for the instalment schedule. */
const contractDetailsSchema = z.object({
  ejarContractNumber: z.string().trim().optional().or(z.literal("")),
  depositAmount: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

/** The terms the schedule is built from — changing any of them rebuilds it. */
const contractTermsSchema = z.object({
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().trim().min(1, "تاريخ النهاية مطلوب"),
  rentAmount: z.string().trim().min(1, "قيمة العقد مطلوبة"),
  amountType: z.enum(["TOTAL", "ANNUAL", "INCREASING"]),
  increasePercent: z.string().trim().optional().or(z.literal("")),
  vatRate: z.enum(["0", "5", "10", "15"]),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "ONE_TIME"]),
});

/**
 * Correcting a contract. The unit and the tenant are not among the fields: a lease with another
 * tenant is another lease, not a correction of this one.
 *
 * The terms behind the schedule are a different matter from the rest. Changing them rebuilds
 * the instalments — and an instalment that carries a financial document is never rebuilt, since
 * deleting it would take an issued invoice or receipt down with it. Those instalments stay as
 * billed and the new terms apply from the ones after them. Only the administrator may change
 * the terms once anything has been issued; for everyone else they are locked.
 */
export async function updateContract(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("contracts.edit");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { payments: { orderBy: { dueDate: "asc" }, include: { documents: { select: { id: true } } } } },
  });
  if (!contract) return { error: "العقد غير موجود" };

  const details = contractDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!details.success) {
    return { error: "تحقق من الحقول", fieldErrors: details.error.flatten().fieldErrors };
  }

  const terms = contractTermsSchema.safeParse(Object.fromEntries(formData));
  if (!terms.success) {
    return { error: "تحقق من الحقول", fieldErrors: terms.error.flatten().fieldErrors };
  }
  const t = terms.data;

  const startDate = new Date(t.startDate);
  const endDate = new Date(t.endDate);
  const rentAmount = Number(t.rentAmount);
  const vatRate = Number(t.vatRate);
  const increasePercent = t.amountType === "INCREASING" ? Number(t.increasePercent || 0) : 0;

  if (endDate <= startDate) return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) return { error: "قيمة العقد غير صحيحة" };
  if (t.amountType === "INCREASING" && increasePercent <= 0) {
    return { error: "نسبة الزيادة السنوية مطلوبة للعقد المتزايد" };
  }

  const termsChanged =
    startDate.getTime() !== contract.startDate.getTime() ||
    endDate.getTime() !== contract.endDate.getTime() ||
    rentAmount !== contract.rentAmount ||
    t.amountType !== contract.amountType ||
    increasePercent !== (contract.increasePercent ?? 0) ||
    vatRate !== contract.vatRate ||
    t.paymentFrequency !== contract.paymentFrequency;

  // An instalment is kept if anything has happened on it: a document, or money recorded before
  // documents were mandatory. Rebuilding it would delete an issued invoice with it, or erase a
  // collection that no longer has any other record.
  const documented = contract.payments.filter((p) => p.documents.length > 0 || (p.paidAmount ?? 0) > 0);

  const detailsData = {
    ejarContractNumber: details.data.ejarContractNumber || null,
    depositAmount: details.data.depositAmount ? Number(details.data.depositAmount) : null,
    notes: details.data.notes || null,
  };

  // Rebuilding a schedule that already carries collections or documents is not an edit but a
  // decision: it goes through the guard, so a deputy files a request and the administrator
  // performs it at once. The details are saved either way — they cost nothing.
  if (termsChanged && documented.length > 0) {
    await prisma.contract.update({ where: { id }, data: detailsData });
    return runSensitive(
      "contracts.terms",
      {
        id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        rentAmount,
        amountType: t.amountType,
        increasePercent,
        vatRate,
        paymentFrequency: t.paymentFrequency,
        details: detailsData,
      },
      String(formData.get("reason") ?? "")
    );
  }

  if (!termsChanged) {
    await prisma.contract.update({ where: { id }, data: detailsData });
    await recordAudit({ user, action: "contracts.edit", summary: `تعديل بيانات العقد ${contract.contractNumber}`, targetId: id });
    revalidatePath(`/contracts/${id}`);
    revalidatePath("/contracts");
    return { success: true, message: "تم حفظ التعديلات" };
  }

  const schedule = buildPaymentSchedule(
    startDate,
    endDate,
    rentAmount,
    t.paymentFrequency,
    t.amountType,
    increasePercent,
    vatRate
  );
  if (schedule.length === 0) return { error: "تعذر توليد جدول الدفعات — راجع التواريخ" };

  // Everything already billed stands; the new terms take effect after the last of it.
  const keptUntil = documented.reduce<Date | null>(
    (latest, p) => (!latest || p.dueDate > latest ? p.dueDate : latest),
    null
  );
  const replaceable = contract.payments.filter((p) => p.documents.length === 0 && !(p.paidAmount ?? 0));
  const fresh = keptUntil ? schedule.filter((p) => p.dueDate > keptUntil) : schedule;

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { id: { in: replaceable.map((p) => p.id) } } }),
    prisma.contract.update({
      where: { id },
      data: {
        ...detailsData,
        startDate,
        endDate,
        rentAmount,
        amountType: t.amountType,
        increasePercent: t.amountType === "INCREASING" ? increasePercent : null,
        vatRate,
        paymentFrequency: t.paymentFrequency,
        payments: { create: fresh.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    }),
  ]);

  await recordAudit({
    user,
    action: "contracts.edit",
    summary: `تعديل شروط العقد ${contract.contractNumber} وإعادة توليد ${fresh.length} قسطاً${
      documented.length ? ` مع إبقاء ${documented.length} قسطاً عليها تحصيل أو مستندات` : ""
    }`,
    targetId: id,
  });

  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  revalidatePath("/payments");
  return {
    success: true,
    message: documented.length
      ? `تم الحفظ — أُبقيت ${documented.length} قسطاً عليها تحصيل أو مستندات، وأُعيد توليد ${fresh.length} قسطاً بالشروط الجديدة`
      : `تم الحفظ وأُعيد توليد ${fresh.length} قسطاً`,
  };
}

/** What has fallen due on a contract and is still short — the sum that keeps a unit held. */
export async function contractArrears(contractId: string) {
  const now = new Date();
  const due = await prisma.payment.findMany({
    where: { contractId, status: { not: "PAID" }, dueDate: { lte: now } },
    select: { amount: true, paidAmount: true },
  });
  return round2(due.reduce((sum, p) => sum + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0));
}

/**
 * Ending a contract does not free the unit. A tenant may have left owing rent, or may still be
 * in place while a renewal is arranged — and a unit released on the strength of a date alone is
 * offered to the next tenant while the last one is still in it, or while their debt is unsettled.
 * So the unit stays held, and releasing it is its own decision: `vacateUnit`.
 *
 * Reactivating a contract does take the unit back, since a live contract is the very thing that
 * holds it.
 */
export async function updateContractStatus(id: string, status: "ACTIVE" | "EXPIRED" | "TERMINATED"): Promise<ActionState> {
  const { user } = await requirePermission("contracts.edit");

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return { error: "العقد غير موجود" };

  await prisma.contract.update({ where: { id }, data: { status } });

  if (status === "ACTIVE") {
    await prisma.unit.update({ where: { id: contract.unitId }, data: { status: "OCCUPIED" } });
  }

  // A broken lease stops calling for rent. Its instalments used to stay behind, so the property
  // went on reporting an income it would never see and arrears that nobody owed — the contract
  // was ended everywhere except in the figures. What was already paid, or already invoiced, is
  // left alone: those are records of things that happened, and the tenant still owes what fell
  // due before the lease was broken.
  let dropped = 0;
  if (status === "TERMINATED") {
    const removable = await prisma.payment.findMany({
      where: {
        contractId: id,
        dueDate: { gt: new Date() },
        OR: [{ paidAmount: null }, { paidAmount: 0 }],
        documents: { none: {} },
      },
      select: { id: true },
    });
    if (removable.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: removable.map((p) => p.id) } } });
      dropped = removable.length;
    }
    revalidatePath("/payments");
  }

  await recordAudit({
    user,
    action: "contracts.edit",
    summary:
      `${status === "ACTIVE" ? "تفعيل" : status === "EXPIRED" ? "إنهاء" : "فسخ"} العقد ${contract.contractNumber}` +
      (dropped > 0 ? ` — وحُذفت ${dropped} دفعة لم يحن موعدها` : ""),
    targetId: id,
  });

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/units");

  if (status === "ACTIVE") return { success: true, message: "تم تفعيل العقد" };

  const arrears = await contractArrears(id);
  return {
    success: true,
    message: arrears > 0
      ? `تم إنهاء العقد. الوحدة تبقى مؤجرة حتى تُسدَّد المستحقات (${formatCurrency(arrears)}) — ثم أخلِها أو جدّد العقد.`
      : "تم إنهاء العقد. الوحدة تبقى مؤجرة حتى تتخذ إجراءً: تجديد العقد، أو إخلاء الوحدة إن خرج المستأجر.",
  };
}

/**
 * Releases the unit once its lease is over: the tenant is out and owes nothing. Held back while
 * anything is due, so a unit is never offered again with the last tenant's debt still open.
 */
/**
 * Settles arrears out of the security deposit the tenant already paid. Not a new collection but
 * money the operator has held all along, moving from security to rent — so it earns its receipt
 * like any other, oldest instalment first, and what it covers is recorded so it is never spent twice.
 */
export async function applyDepositToArrears(contractId: string): Promise<ActionState> {
  const { user } = await requirePermission("payments.pay");

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return { error: "العقد غير موجود" };

  const available = round2((contract.depositAmount ?? 0) - contract.depositApplied);
  if (available <= 0) {
    return { error: contract.depositAmount ? "استُهلك التأمين بالكامل" : "لا يوجد تأمين مسجّل على هذا العقد" };
  }

  const now = new Date();
  const short = await prisma.payment.findMany({
    where: { contractId, status: { not: "PAID" }, dueDate: { lte: now } },
    orderBy: { dueDate: "asc" },
  });
  if (short.length === 0) return { error: "لا توجد متأخرات على هذا العقد" };

  // The deposit fills the oldest instalments first, exactly as an overpayment rolls forward.
  const plan = allocate(available, short);
  const left = plan.left;
  const receipts: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const { target: p, add } of plan.allocations) {
        const total = round2((p.paidAmount ?? 0) + add);

        await tx.payment.update({
          where: { id: p.id },
          data: {
            paidAmount: total,
            paidDate: now,
            collectedById: user.id,
            method: "خصم من التأمين",
            recipient: "OPERATOR",
            notes: [p.notes, `سُدِّد ${formatCurrency(add)} من تأمين العقد`].filter(Boolean).join(" — "),
            status: total >= p.amount ? "PAID" : "PARTIAL",
          },
        });

        const receipt = await issueReceiptForPayment(p.id, { issuedById: user.id, db: tx, amount: add });
        if (!receipt.ok) throw new Error(receipt.error);
        receipts.push(receipt.documentNumber);
      }

      await tx.contract.update({
        where: { id: contractId },
        data: { depositApplied: round2(contract.depositApplied + (available - left)) },
      });
    });
  } catch (err) {
    return { error: `لم يُخصم التأمين — ${err instanceof Error ? err.message : "خطأ غير متوقع"}` };
  }

  const used = round2(available - left);
  await recordAudit({
    user,
    action: "payments.pay",
    summary: `خصم ${formatCurrency(used)} من تأمين العقد ${contract.contractNumber} سداداً لمتأخراته`,
    targetId: contractId,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/payments");
  revalidatePath("/documents");
  return {
    success: true,
    message: `خُصم ${formatCurrency(used)} من التأمين وصدرت سنداته (${receipts.join("، ")})${
      left > 0 ? ` — تبقّى من التأمين ${formatCurrency(left)}` : ""
    }`,
  };
}

/** Refers every unpaid instalment that has fallen due to Najiz, so the claim is formally pursued. */
export async function referContractArrearsToNajiz(contractId: string): Promise<ActionState> {
  const { user } = await requirePermission("payments.edit");

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return { error: "العقد غير موجود" };

  const now = new Date();
  const { count } = await prisma.payment.updateMany({
    where: { contractId, status: { not: "PAID" }, dueDate: { lte: now }, najizReferredAt: null },
    data: { najizReferredAt: now },
  });
  if (count === 0) return { error: "لا توجد متأخرات غير محالة على هذا العقد" };

  await recordAudit({
    user,
    action: "payments.edit",
    summary: `إحالة متأخرات العقد ${contract.contractNumber} إلى ناجز (${count} دفعة)`,
    targetId: contractId,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/payments/najiz");
  return { success: true, message: `أُحيلت ${count} دفعة إلى ناجز — يمكنك الآن إخلاء الوحدة والمطالبة قائمة` };
}

/**
 * Releases the unit once its lease is over.
 *
 * The debt is not what holds the unit — it follows the tenant, not the walls, and keeping an empty
 * flat off the market for months while a claim runs collects nothing and loses the next tenant's
 * rent too. What is required is that the debt be dealt with, not collected: settled from the
 * deposit, referred to Najiz and pursued, or released knowingly with a reason on record. It stays
 * on the contract either way — in arrears, in collections, and in the owner's statement.
 */
export async function vacateUnit(contractId: string, reason?: string): Promise<ActionState> {
  const { user } = await requirePermission("units.edit");

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { unit: { select: { id: true, unitNumber: true, status: true } } },
  });
  if (!contract) return { error: "العقد غير موجود" };
  if (contract.status === "ACTIVE") return { error: "لا تُخلى وحدة وعقدها ساري — أنهِ العقد أولاً" };
  if (contract.unit.status === "VACANT") return { error: "الوحدة شاغرة أصلاً" };

  const arrears = await contractArrears(contractId);
  const note = reason?.trim();

  if (arrears > 0 && !note) {
    const unreferred = await prisma.payment.count({
      where: { contractId, status: { not: "PAID" }, dueDate: { lte: new Date() }, najizReferredAt: null },
    });
    if (unreferred > 0) {
      return {
        error: `على العقد مستحقات ${formatCurrency(arrears)} — اخصمها من التأمين، أو أحِلها إلى ناجز، أو أخلِ الوحدة بإقرار مكتوب.`,
        needsReason: true,
      };
    }
  }

  await prisma.unit.update({ where: { id: contract.unit.id }, data: { status: "VACANT" } });

  const tail =
    arrears > 0
      ? ` مع بقاء مستحقات ${formatCurrency(arrears)} مطالبةً على المستأجر${note ? ` — ${note}` : " محالة إلى ناجز"}`
      : "";
  await recordAudit({
    user,
    action: "units.edit",
    summary: `إخلاء الوحدة ${contract.unit.unitNumber} بعد انتهاء العقد ${contract.contractNumber}${tail}`,
    targetId: contract.unit.id,
  });

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/units");
  return {
    success: true,
    message:
      arrears > 0
        ? `أصبحت الوحدة شاغرة ومتاحة للتأجير — ومستحقات ${formatCurrency(arrears)} باقية في المتابعة على المستأجر`
        : "أصبحت الوحدة شاغرة ومتاحة للتأجير",
  };
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
