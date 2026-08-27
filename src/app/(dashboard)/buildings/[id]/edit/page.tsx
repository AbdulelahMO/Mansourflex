import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { BuildingForm } from "@/components/buildings/building-form";
import { updateBuilding } from "@/lib/actions/buildings";

export default async function EditBuildingPage(props: PageProps<"/buildings/[id]/edit">) {
  await requirePagePermission("buildings.edit");
  const { id } = await props.params;

  const [building, owners] = await Promise.all([
    prisma.building.findUnique({ where: { id }, include: { contacts: true, meters: true } }),
    prisma.owner.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!building) notFound();

  const action = updateBuilding.bind(null, building.id);

  return (
    <div className="space-y-4">
      <Link
        href={`/buildings/${building.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-4" />
        العودة لتفاصيل المبنى
      </Link>

      <div>
        <h1 className="text-2xl font-bold">تعديل المبنى</h1>
        <p className="text-sm text-muted-foreground">{building.name}</p>
      </div>

      <BuildingForm owners={owners} building={building} action={action} submitLabel="حفظ التعديلات" />
    </div>
  );
}
