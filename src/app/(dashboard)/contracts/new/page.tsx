import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { ContractForm } from "@/components/contracts/contract-form";

export default async function NewContractPage() {
  await requirePagePermission("contracts.create");

  const [buildings, units, tenants] = await Promise.all([
    prisma.building.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ include: { building: true }, orderBy: { unitNumber: "asc" } }),
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للعقود
      </Link>

      <div>
        <h1 className="text-2xl font-bold">إنشاء عقد إيجار جديد</h1>
        <p className="text-sm text-muted-foreground">سيتم إنشاء جدول الدفعات تلقائياً حسب طريقة السداد</p>
      </div>

      <ContractForm buildings={buildings} units={units} tenants={tenants} />
    </div>
  );
}
