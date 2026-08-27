"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormDialog } from "@/components/form-dialog";
import { createIntegration, updateIntegration } from "@/lib/actions/integrations";
import { Plus, Pencil } from "lucide-react";

type Integration = {
  id: string;
  name: string;
  type: string;
  apiKey: string | null;
  apiSecret: string | null;
  endpointUrl: string | null;
  isActive: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  PAYMENT_GATEWAY: "بوابة دفع",
  SMS: "رسائل SMS",
  WHATSAPP: "واتساب",
  EMAIL: "بريد إلكتروني (SMTP)",
  WEBHOOK: "Webhook عام",
  OTHER: "أخرى",
};

function IntegrationFields({ integration }: { integration?: Integration }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">اسم الجهة</Label>
        <Input id="name" name="name" required defaultValue={integration?.name} placeholder="مثال: PayTabs" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">نوع الجهة</Label>
        <Select name="type" defaultValue={integration?.type ?? "WEBHOOK"} required>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endpointUrl">رابط الخدمة (Endpoint URL)</Label>
        <Input id="endpointUrl" name="endpointUrl" dir="ltr" defaultValue={integration?.endpointUrl ?? ""} placeholder="https://api.example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apiKey">مفتاح API</Label>
        <Input id="apiKey" name="apiKey" dir="ltr" defaultValue={integration?.apiKey ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apiSecret">السر (Secret) — يُستخدم أيضاً للتحقق من طلبات Webhook الواردة</Label>
        <Input id="apiSecret" name="apiSecret" dir="ltr" type="password" defaultValue={integration?.apiSecret ?? ""} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <p className="text-sm font-medium">تفعيل الربط</p>
        <Switch name="isActive" defaultChecked={integration?.isActive ?? false} />
      </div>
    </>
  );
}

export function CreateIntegrationDialog() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          إضافة ربط جديد
        </Button>
      }
      title="إضافة جهة خارجية"
      description="أضف بيانات الاتصال بأي جهة خارجية (بوابة دفع، SMS، واتساب، أو أي API آخر)"
      action={createIntegration}
      submitLabel="إضافة"
    >
      <IntegrationFields />
    </FormDialog>
  );
}

export function EditIntegrationDialog({ integration }: { integration: Integration }) {
  const action = updateIntegration.bind(null, integration.id);
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon">
          <Pencil className="size-4" />
        </Button>
      }
      title="تعديل بيانات الربط"
      action={action}
      submitLabel="حفظ التعديلات"
    >
      <IntegrationFields integration={integration} />
    </FormDialog>
  );
}

export { TYPE_LABELS };
