import { requirePagePermission } from "@/lib/authz";
import { ImportCard } from "@/components/settings/import-card";

/** Bringing a portfolio in is work done once at the start, not a setting kept and revisited. */
export default async function ImportPage() {
  await requirePagePermission("contracts.create");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">استيراد البيانات</h1>
        <p className="text-sm text-muted-foreground">إدخال محفظة قائمة من ملف Excel دفعة واحدة</p>
      </div>

      <ImportCard />
    </div>
  );
}
