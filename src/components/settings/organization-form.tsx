"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { updateOrganizationSettings } from "@/lib/actions/organization";
import { initialActionState } from "@/lib/types";
import { DEFAULT_AGREEMENT_PREAMBLE, DEFAULT_AGREEMENT_CLOSING } from "@/lib/agreement-text";
import { ImageIcon } from "lucide-react";

type OrganizationSettings = {
  name: string | null;
  commercialRegister: string | null;
  taxNumber: string | null;
  phone: string | null;
  address: string | null;
  nationalAddress: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  agreementPreamble: string | null;
  agreementClosing: string | null;
  logoUrl: string | null;
} | null;

export function OrganizationForm({ settings }: { settings: OrganizationSettings }) {
  const [state, formAction] = useActionState(updateOrganizationSettings, initialActionState);

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            هذه البيانات تظهر في ترويسة الفواتير وسندات القبض، وفي صيغة اتفاقيات الإدارة بوصفها بيانات الطرف الأول
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="name">اسم المنشأة</Label>
            <Input id="name" name="name" defaultValue={settings?.name ?? ""} placeholder="مثال: السويد للعقارات" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="commercialRegister">السجل التجاري</Label>
              <Input
                id="commercialRegister"
                name="commercialRegister"
                dir="ltr"
                defaultValue={settings?.commercialRegister ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" name="phone" dir="ltr" defaultValue={settings?.phone ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="taxNumber">الرقم الضريبي</Label>
              <Input id="taxNumber" name="taxNumber" dir="ltr" defaultValue={settings?.taxNumber ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" name="address" defaultValue={settings?.address ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nationalAddress">العنوان الوطني</Label>
            <Input
              id="nationalAddress"
              name="nationalAddress"
              defaultValue={settings?.nationalAddress ?? ""}
              placeholder="مثال: 3195 طريق الملك عبدالعزيز - النزهة - الرياض 12345"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="signatoryName">اسم المفوّض بالتوقيع</Label>
              <Input id="signatoryName" name="signatoryName" defaultValue={settings?.signatoryName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signatoryTitle">صفته</Label>
              <Input
                id="signatoryTitle"
                name="signatoryTitle"
                defaultValue={settings?.signatoryTitle ?? ""}
                placeholder="مثال: المدير العام"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-semibold">نصوص اتفاقية الإدارة</p>
              <p className="text-xs text-muted-foreground">
                تظهر في صيغة الاتفاقية المطبوعة. اتركها فارغة لاستخدام الصياغة الافتراضية.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agreementPreamble">التمهيد</Label>
              <Textarea
                id="agreementPreamble"
                name="agreementPreamble"
                rows={5}
                defaultValue={settings?.agreementPreamble ?? ""}
                placeholder={DEFAULT_AGREEMENT_PREAMBLE}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agreementClosing">الخاتمة (قبل التوقيعات)</Label>
              <Textarea
                id="agreementClosing"
                name="agreementClosing"
                rows={2}
                defaultValue={settings?.agreementClosing ?? ""}
                placeholder={DEFAULT_AGREEMENT_CLOSING}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="logo" className="flex items-center gap-1.5">
              <ImageIcon className="size-3.5" />
              شعار المنشأة
            </Label>
            <Input id="logo" name="logo" type="file" accept=".png,.jpg,.jpeg,.webp" />
            {settings?.logoUrl && (
              <img
                src={`/api/files/${settings.logoUrl}`}
                alt="الشعار الحالي"
                className="mt-2 h-16 w-auto rounded border object-contain p-1"
              />
            )}
          </div>

          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p className="text-sm text-emerald-600" aria-live="polite">
              {state.message}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <SubmitButton>حفظ</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
