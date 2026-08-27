import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { AgreementForm } from "@/components/agreements/agreement-form";
import { createAgreement } from "@/lib/actions/agreements";

export default async function NewAgreementPage() {
  await requirePagePermission("agreements.create");

  const [owners, buildings] = await Promise.all([
    // An agreement must cover at least one building, so owners with none are a dead end here.
    prisma.owner.findMany({
      where: { buildings: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.building.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, ownerId: true } }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/agreements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للاتفاقيات
      </Link>

      <div>
        <h1 className="text-2xl font-bold">اتفاقية إدارة جديدة</h1>
        <p className="text-sm text-muted-foreground">حدّد المالك والمبنى المشمول ونسبة العمولة — لكل مبنى اتفاقية مستقلة</p>
      </div>

      <AgreementForm owners={owners} buildings={buildings} action={createAgreement} submitLabel="حفظ الاتفاقية" />
    </div>
  );
}
