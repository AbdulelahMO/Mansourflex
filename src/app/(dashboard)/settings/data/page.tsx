import { requirePagePermission } from "@/lib/authz";
import { BackupCard } from "@/components/settings/backup-card";
import { ResetCard } from "@/components/settings/reset-card";

/**
 * The two acts that decide what data survives. They belong together and away from the settings
 * anyone edits in a normal week: one takes a copy, the other empties the system — and the second
 * is only ever done after the first.
 */
export default async function DataPage() {
  await requirePagePermission("settings.organization");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">البيانات والنسخ</h1>
        <p className="text-sm text-muted-foreground">نسخة احتياطية من النظام، أو تفريغه والبدء من جديد</p>
      </div>

      <BackupCard />
      <ResetCard />
    </div>
  );
}
