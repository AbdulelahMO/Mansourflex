import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildSettlement } from "@/lib/settlement";
import { buildingClosure, closureSummary, duesSummary } from "@/lib/core/building-closure";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ActionState } from "@/lib/types";

/**
 * The operations that a role may only hold as "يحتاج موافقة". They live outside the
 * "use server" files on purpose: an exported action is a callable endpoint, and these must
 * never be reachable without passing the guard. Both the guarded action and the approval
 * executor call the same `run`, so an approved request performs exactly the requested act.
 *
 * `run` re-validates its own preconditions, because an approval may land days after the
 * request and the record may have changed in between.
 */
export type SensitiveOp<P = Record<string, unknown>> = {
  permission: string;
  /** Human sentence stored on the request, so the approver sees what they are deciding. */
  describe: (payload: P) => Promise<string>;
  run: (payload: P) => Promise<ActionState>;
};

type IdPayload = { id: string };

const missing = (what: string): ActionState => ({ error: `${what} غير موجود` });

export const SENSITIVE_OPS: Record<string, SensitiveOp<never>> = {
  "owners.delete": {
    permission: "owners.delete",
    describe: async ({ id }: IdPayload) => {
      const o = await prisma.owner.findUnique({ where: { id }, select: { name: true } });
      return `حذف المالك «${o?.name ?? id}»`;
    },
    run: async ({ id }: IdPayload) => {
      const owner = await prisma.owner.findUnique({ where: { id } });
      if (!owner) return missing("المالك");
      const buildingsCount = await prisma.building.count({ where: { ownerId: id } });
      if (buildingsCount > 0) {
        return { error: "لا يمكن حذف مالك مرتبط بمباني. احذف المباني أولاً أو انقلها لمالك آخر" };
      }
      await prisma.owner.delete({ where: { id } });
      revalidatePath("/owners");
      return { success: true };
    },
  },

  "buildings.delete": {
    permission: "buildings.delete",
    describe: async ({ id }: IdPayload) => {
      const c = await buildingClosure(id);
      if (!c) return `حذف المبنى ${id}`;
      const dues = duesSummary(c);
      return closureSummary(c) + (dues ? ` — مع مستحقات قائمة: ${dues}` : "");
    },
    run: async ({ id, acknowledged }: { id: string; acknowledged?: boolean }) => {
      const c = await buildingClosure(id);
      if (!c) return missing("المبنى");

      // Outstanding money must be settled, or knowingly waived by whoever authorised this.
      if (c.hasDues && !acknowledged) {
        return { error: `على هذا المبنى مستحقات قائمة (${duesSummary(c)}) — لا يمكن الحذف قبل تصفيتها.` };
      }

      // Contracts hold their unit, so the chain comes down in order: contracts, units, building.
      // Payments, documents, expenses and photos fall with their parent by cascade.
      await prisma.$transaction([
        prisma.contract.deleteMany({ where: { unit: { buildingId: id } } }),
        prisma.unit.deleteMany({ where: { buildingId: id } }),
        prisma.building.delete({ where: { id } }),
      ]);

      revalidatePath("/buildings");
      revalidatePath("/units");
      revalidatePath("/contracts");
      return { success: true, message: `حُذف المبنى «${c.name}» وكل ما يتبعه` };
    },
  },

  "units.delete": {
    permission: "units.delete",
    describe: async ({ id }: IdPayload) => {
      const u = await prisma.unit.findUnique({ where: { id }, include: { building: { select: { name: true } } } });
      return `حذف الوحدة «${u?.unitNumber ?? id}» في ${u?.building.name ?? "—"}`;
    },
    run: async ({ id }: IdPayload) => {
      const unit = await prisma.unit.findUnique({ where: { id } });
      if (!unit) return missing("الوحدة");
      const contractsCount = await prisma.contract.count({ where: { unitId: id } });
      if (contractsCount > 0) return { error: "لا يمكن حذف وحدة مرتبطة بعقود" };
      await prisma.unit.delete({ where: { id } });
      revalidatePath("/units");
      return { success: true };
    },
  },

  "tenants.delete": {
    permission: "tenants.delete",
    describe: async ({ id }: IdPayload) => {
      const t = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
      return `حذف المستأجر «${t?.name ?? id}»`;
    },
    run: async ({ id }: IdPayload) => {
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return missing("المستأجر");
      const contractsCount = await prisma.contract.count({ where: { tenantId: id } });
      if (contractsCount > 0) return { error: "لا يمكن حذف مستأجر مرتبط بعقود" };
      await prisma.tenant.delete({ where: { id } });
      revalidatePath("/tenants");
      return { success: true };
    },
  },

  "contracts.delete": {
    permission: "contracts.delete",
    describe: async ({ id }: IdPayload) => {
      const c = await prisma.contract.findUnique({ where: { id }, select: { contractNumber: true } });
      return `حذف العقد ${c?.contractNumber ?? id}`;
    },
    run: async ({ id }: IdPayload) => {
      const contract = await prisma.contract.findUnique({ where: { id } });
      if (!contract) return missing("العقد");
      await prisma.contract.delete({ where: { id } });
      await prisma.unit.update({ where: { id: contract.unitId }, data: { status: "VACANT" } }).catch(() => {});
      revalidatePath("/contracts");
      revalidatePath("/units");
      return { success: true };
    },
  },

  "expenses.delete": {
    permission: "expenses.delete",
    describe: async ({ id }: IdPayload) => {
      const e = await prisma.expense.findUnique({ where: { id }, select: { description: true, amount: true } });
      return e ? `حذف المصروف «${e.description}» بمبلغ ${formatCurrency(e.amount)}` : `حذف المصروف ${id}`;
    },
    run: async ({ id }: IdPayload) => {
      const found = await prisma.expense.findUnique({ where: { id }, select: { buildingId: true } });
      if (!found) return missing("المصروف");
      await prisma.expense.delete({ where: { id } });
      revalidatePath("/expenses");
      revalidatePath(`/buildings/${found.buildingId}`);
      return { success: true };
    },
  },

  "documents.cancel": {
    permission: "documents.cancel",
    describe: async ({ id }: IdPayload) => {
      const d = await prisma.financialDocument.findUnique({
        where: { id },
        select: { documentNumber: true, amount: true },
      });
      return d ? `إلغاء المستند ${d.documentNumber} بمبلغ ${formatCurrency(d.amount)}` : `إلغاء المستند ${id}`;
    },
    run: async ({ id, reason }: { id: string; reason?: string }) => {
      const doc = await prisma.financialDocument.findUnique({ where: { id } });
      if (!doc) return missing("المستند");
      if (doc.status === "CANCELLED") return { error: `سبق إلغاء المستند ${doc.documentNumber}` };

      // A receipt stands on its invoice, so the invoice cannot be voided while one is live.
      if (doc.type === "INVOICE" && doc.paymentId) {
        const receipts = await prisma.financialDocument.findMany({
          where: { paymentId: doc.paymentId, type: "RECEIPT", status: { not: "CANCELLED" } },
          select: { documentNumber: true },
          orderBy: { documentNumber: "asc" },
        });
        if (receipts.length > 0) {
          const list = receipts.map((r) => r.documentNumber).join("، ");
          return {
            error: `لا يمكن إلغاء الفاتورة ${doc.documentNumber} لوجود سند قبض ساري عليها (${list}) — ألغِ السند أولاً.`,
          };
        }
      }

      const now = new Date();

      // A remittance voucher is the transfer itself, so voiding it returns the money to the
      // owner's balance. Marked cancelled rather than deleted — deleting the transfer would
      // take the voucher down with it, which is exactly what cancelling avoids. Both writes
      // go together: a half-applied cancellation would leave the balance disagreeing with
      // the paperwork.
      await prisma.$transaction([
        prisma.financialDocument.update({
          where: { id },
          data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason?.trim() || null },
        }),
        ...(doc.type === "OWNER_REMITTANCE" && doc.remittanceId
          ? [prisma.ownerRemittance.update({ where: { id: doc.remittanceId }, data: { cancelledAt: now } })]
          : []),
      ]);

      if (doc.remittanceId) {
        const remittance = await prisma.ownerRemittance.findUnique({
          where: { id: doc.remittanceId },
          select: { ownerId: true },
        });
        if (remittance) revalidatePath(`/owners/${remittance.ownerId}`);
      }

      if (doc.contractId) revalidatePath(`/contracts/${doc.contractId}`);
      revalidatePath("/documents");
      revalidatePath("/expenses");
      return { success: true, message: `أُلغي المستند ${doc.documentNumber}` };
    },
  },

  "agreements.delete": {
    permission: "agreements.delete",
    describe: async ({ id }: IdPayload) => {
      const a = await prisma.managementAgreement.findUnique({ where: { id }, select: { agreementNumber: true } });
      return `حذف الاتفاقية ${a?.agreementNumber ?? id}`;
    },
    run: async ({ id }: IdPayload) => {
      const found = await prisma.managementAgreement.findUnique({ where: { id } });
      if (!found) return missing("الاتفاقية");
      await prisma.managementAgreement.delete({ where: { id } });
      revalidatePath("/agreements");
      return { success: true };
    },
  },

  "agreements.settle": {
    permission: "agreements.settle",
    describe: async ({ id, settledAt }: { id: string; settledAt: string; notes?: string }) => {
      const a = await prisma.managementAgreement.findUnique({
        where: { id },
        include: { buildings: { include: { building: { select: { name: true } } } } },
      });
      const building = a?.buildings[0]?.building.name;
      return `تصفية الاتفاقية ${a?.agreementNumber ?? id}${building ? ` (${building})` : ""} وإنهاؤها بتاريخ ${formatDate(new Date(settledAt))}`;
    },
    run: async ({ id, settledAt, notes }: { id: string; settledAt: string; notes?: string }) => {
      const agreement = await prisma.managementAgreement.findUnique({ where: { id }, include: { settlement: true } });
      if (!agreement) return missing("الاتفاقية");
      if (agreement.settlement) return { error: "سبق تصفية هذه الاتفاقية وإنهاؤها" };
      if (agreement.status !== "ACTIVE") return { error: "لا تُصفّى إلا الاتفاقيات السارية" };

      const date = new Date(settledAt);
      if (Number.isNaN(date.getTime())) return { error: "تاريخ الإنهاء غير صحيح" };
      if (date < agreement.startDate) return { error: "تاريخ الإنهاء يسبق بداية الاتفاقية" };

      const s = await buildSettlement(id, date);
      if (!s) return { error: "تعذر احتساب التصفية — لا يوجد مبنى مرتبط بالاتفاقية" };

      await prisma.$transaction([
        prisma.agreementSettlement.create({
          data: {
            agreementId: id,
            settledAt: date,
            periodFrom: s.periodFrom,
            periodTo: s.periodTo,
            collected: s.collected,
            ownerExpenses: s.ownerExpenses,
            netCollected: s.netCollected,
            commissionPercent: s.commissionPercent,
            commission: s.commission,
            operatorExpenses: s.operatorExpenses,
            netCommission: s.netCommission,
            payableToOwner: s.payableToOwner,
            pendingArrears: s.pendingArrears,
            pendingExpenses: s.pendingExpenses,
            previousEndDate: agreement.endDate,
            notes: notes || null,
          },
        }),
        prisma.managementAgreement.update({
          where: { id },
          data: { status: "TERMINATED", endDate: date },
        }),
      ]);

      revalidatePath("/agreements");
      revalidatePath(`/agreements/${id}`);
      return { success: true, message: "تمت التصفية وإنهاء الاتفاقية" };
    },
  },

  "agreements.cancelSettlement": {
    permission: "agreements.cancelSettlement",
    describe: async ({ id }: IdPayload) => {
      const a = await prisma.managementAgreement.findUnique({ where: { id }, select: { agreementNumber: true } });
      return `إلغاء تصفية الاتفاقية ${a?.agreementNumber ?? id} وإعادتها سارية`;
    },
    run: async ({ id }: IdPayload) => {
      const agreement = await prisma.managementAgreement.findUnique({
        where: { id },
        include: { settlement: true, buildings: { select: { buildingId: true } } },
      });
      if (!agreement) return missing("الاتفاقية");
      if (!agreement.settlement) return { error: "لا توجد تصفية لإلغائها" };

      // Reinstating must not put a building under two active agreements at once.
      const clash = await prisma.agreementBuilding.findFirst({
        where: {
          buildingId: { in: agreement.buildings.map((b) => b.buildingId) },
          agreement: { status: "ACTIVE", id: { not: id } },
        },
        include: { building: { select: { name: true } }, agreement: { select: { agreementNumber: true } } },
      });
      if (clash) {
        return {
          error: `المبنى "${clash.building.name}" مشمول باتفاقية سارية أخرى (${clash.agreement.agreementNumber})`,
        };
      }

      await prisma.$transaction([
        prisma.agreementSettlement.delete({ where: { agreementId: id } }),
        prisma.managementAgreement.update({
          where: { id },
          data: { status: "ACTIVE", endDate: agreement.settlement.previousEndDate ?? agreement.endDate },
        }),
      ]);

      revalidatePath("/agreements");
      revalidatePath(`/agreements/${id}`);
      return { success: true, message: "أُلغيت التصفية وعادت الاتفاقية سارية" };
    },
  },
};

export function sensitiveOp(action: string) {
  return SENSITIVE_OPS[action] as SensitiveOp<Record<string, unknown>> | undefined;
}
