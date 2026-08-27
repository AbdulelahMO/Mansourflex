import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { BuildingForm } from "@/components/buildings/building-form";
import { createBuilding } from "@/lib/actions/buildings";

export default async function NewBuildingPage() {
  await requirePagePermission("buildings.create");

  const owners = await prisma.owner.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <Link href="/buildings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للمباني
      </Link>

      <div>
        <h1 className="text-2xl font-bold">إضافة مبنى جديد</h1>
        <p className="text-sm text-muted-foreground">أدخل بيانات المبنى الأساسية</p>
      </div>

      <BuildingForm owners={owners} action={createBuilding} submitLabel="إضافة المبنى" />
    </div>
  );
}
