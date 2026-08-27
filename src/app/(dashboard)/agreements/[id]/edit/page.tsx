import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { AgreementForm } from "@/components/agreements/agreement-form";
import { updateAgreement } from "@/lib/actions/agreements";

export default async function EditAgreementPage(props: PageProps<"/agreements/[id]/edit">) {
  const { id } = await props.params;
  await requirePagePermission("agreements.edit");

  const agreement = await prisma.managementAgreement.findUnique({ where: { id }, include: { buildings: true } });
  if (!agreement) notFound();

  const [owners, buildings] = await Promise.all([
    // Owners with no buildings are a dead end, but this agreement's own owner stays listed
    // even if their buildings were removed later — otherwise the field would render empty.
    prisma.owner.findMany({
      where: { OR: [{ buildings: { some: {} } }, { id: agreement.ownerId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.building.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, ownerId: true } }),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href={`/agreements/${agreement.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-4" />
        العودة للاتفاقية
      </Link>

      <div>
        <h1 className="text-2xl font-bold">تعديل الاتفاقية</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {agreement.agreementNumber}
        </p>
      </div>

      <AgreementForm
        owners={owners}
        buildings={buildings}
        cancelHref={`/agreements/${agreement.id}`}
        agreement={{
          ownerId: agreement.ownerId,
          startDate: agreement.startDate,
          endDate: agreement.endDate,
          status: agreement.status,
          signedAt: agreement.signedAt,
          signedPlace: agreement.signedPlace,
          fileUrl: agreement.fileUrl,
          terms: agreement.terms,
          duties: agreement.duties,
          notes: agreement.notes,
          otherAuthorities: agreement.otherAuthorities,
          canSignContracts: agreement.canSignContracts,
          canCollectRent: agreement.canCollectRent,
          canMaintain: agreement.canMaintain,
          maintenanceLimit: agreement.maintenanceLimit,
          canLitigate: agreement.canLitigate,
          canNegotiateRenewal: agreement.canNegotiateRenewal,
          lines: agreement.buildings.map((b) => ({
            buildingId: b.buildingId,
            commissionPercent: b.commissionPercent,
          })),
        }}
        action={updateAgreement.bind(null, agreement.id)}
        submitLabel="حفظ التعديلات"
      />
    </div>
  );
}
