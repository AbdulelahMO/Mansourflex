import { requirePagePermission } from "@/lib/authz";
import { getOrganizationSettings } from "@/lib/actions/organization";
import { OrganizationForm } from "@/components/settings/organization-form";
import { BackupCard } from "@/components/settings/backup-card";
import { ResetCard } from "@/components/settings/reset-card";
import { ImportCard } from "@/components/settings/import-card";

export default async function OrganizationSettingsPage() {
  await requirePagePermission("settings.organization");
  const settings = await getOrganizationSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">بيانات المنشأة</h1>
        <p className="text-sm text-muted-foreground">الاسم، السجل التجاري، الهاتف، والشعار المستخدم في المستندات المالية</p>
      </div>

      <OrganizationForm settings={settings} />

      <ImportCard />
      <BackupCard />
      <ResetCard />
    </div>
  );
}
