import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission, statesFor } from "@/lib/authz";
import { ContractEditForm } from "@/components/contracts/contract-edit-form";
import { updateContract } from "@/lib/actions/contracts";

/** Dates reach the form as they are stored, without a timezone shifting them a day. */
function toInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function EditContractPage(props: PageProps<"/contracts/[id]/edit">) {
  await requirePagePermission("contracts.edit");
  const { id } = await props.params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      unit: { include: { building: { select: { name: true } } } },
      tenant: { select: { name: true } },
      payments: { select: { id: true, paidAmount: true, documents: { select: { id: true } } } },
    },
  });
  if (!contract) notFound();

  // An instalment with a document or a recorded collection is never rebuilt: deleting it would
  // take an issued document with it, or erase money that has no other record.
  const documentedCount = contract.payments.filter(
    (p) => p.documents.length > 0 || (p.paidAmount ?? 0) > 0
  ).length;

  const { "contracts.terms": termsState } = await statesFor(["contracts.terms"]);

  return (
    <div className="space-y-4">
      <Link
        href={`/contracts/${contract.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-4" />
        العودة لتفاصيل العقد
      </Link>

      <div>
        <h1 className="text-2xl font-bold">تعديل العقد</h1>
        <p className="text-sm text-muted-foreground">
          <span dir="ltr">{contract.contractNumber}</span> · {contract.tenant.name} ·{" "}
          {contract.unit.building.name} - وحدة {contract.unit.unitNumber}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          الوحدة والمستأجر لا يُعدَّلان — عقد بمستأجر أو وحدة أخرى عقدٌ جديد لا تصحيح لهذا.
        </p>
      </div>

      <ContractEditForm
        contract={{
          contractNumber: contract.contractNumber,
          ejarContractNumber: contract.ejarContractNumber,
          startDate: toInput(contract.startDate),
          endDate: toInput(contract.endDate),
          rentAmount: contract.rentAmount,
          amountType: contract.amountType,
          increasePercent: contract.increasePercent,
          vatRate: contract.vatRate,
          depositAmount: contract.depositAmount,
          paymentFrequency: contract.paymentFrequency,
          notes: contract.notes,
        }}
        action={updateContract.bind(null, contract.id)}
        documentedCount={documentedCount}
        termsState={termsState}
      />
    </div>
  );
}
