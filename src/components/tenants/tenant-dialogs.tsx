"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { createTenant, updateTenant } from "@/lib/actions/tenants";
import { Plus, Pencil } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  tenantType: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  commercialRegister: string | null;
  unifiedNumber: string | null;
  representativeName: string | null;
  representativeNationalId: string | null;
  representativePhone: string | null;
  representativeEmail: string | null;
  notes: string | null;
};

const TENANT_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "فرد" },
  { value: "COMPANY", label: "شركة / مؤسسة" },
];

function TenantTypeField({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tenantType">نوع المستأجر</Label>
      <Select name="tenantType" value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger className="w-full" id="tenantType">
          <SelectValue placeholder="اختر نوع المستأجر" />
        </SelectTrigger>
        <SelectContent>
          {TENANT_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The one field set behind every "add tenant" form in the app, wherever it is opened from. */
export function TenantFields({ tenant }: { tenant?: Tenant }) {
  const [tenantType, setTenantType] = useState(tenant?.tenantType ?? "");
  const isCompany = tenantType === "COMPANY";

  return (
    <>
      <TenantTypeField value={tenantType} onValueChange={setTenantType} />
      <div className="space-y-1.5">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" name="name" required defaultValue={tenant?.name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            الجوال<span className="text-destructive"> *</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            dir="ltr"
            required
            pattern="\d{10}"
            title="يتكون من 10 أرقام"
            defaultValue={tenant?.phone ?? ""}
          />
        </div>
        {isCompany ? (
          <div className="space-y-1.5">
            <Label htmlFor="unifiedNumber">
              الرقم الموحد<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="unifiedNumber"
              name="unifiedNumber"
              dir="ltr"
              required
              pattern="700\d{7}"
              title="يبدأ بـ700 ويتكون من 10 أرقام"
              placeholder="700xxxxxxx"
              defaultValue={tenant?.unifiedNumber ?? ""}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="nationalId">
              رقم الهوية<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="nationalId"
              name="nationalId"
              dir="ltr"
              required
              pattern="\d{10}"
              title="يتكون من 10 أرقام"
              defaultValue={tenant?.nationalId ?? ""}
            />
          </div>
        )}
      </div>
      <div className={isCompany ? "grid grid-cols-2 gap-3" : "space-y-1.5"}>
        <div className="space-y-1.5">
          <Label htmlFor="email">
            البريد الإلكتروني<span className="text-destructive"> *</span>
          </Label>
          <Input id="email" name="email" type="email" required dir="ltr" defaultValue={tenant?.email ?? ""} />
        </div>
        {isCompany && (
          <div className="space-y-1.5">
            <Label htmlFor="commercialRegister">السجل التجاري</Label>
            <Input id="commercialRegister" name="commercialRegister" dir="ltr" defaultValue={tenant?.commercialRegister ?? ""} />
          </div>
        )}
      </div>

      {isCompany && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-semibold">ممثل الشركة / المؤسسة</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="representativeName">
                الاسم<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="representativeName"
                name="representativeName"
                required
                defaultValue={tenant?.representativeName ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="representativeNationalId">رقم الهوية</Label>
              <Input
                id="representativeNationalId"
                name="representativeNationalId"
                dir="ltr"
                defaultValue={tenant?.representativeNationalId ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="representativePhone">الجوال</Label>
              <Input
                id="representativePhone"
                name="representativePhone"
                dir="ltr"
                defaultValue={tenant?.representativePhone ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="representativeEmail">البريد الإلكتروني</Label>
              <Input
                id="representativeEmail"
                name="representativeEmail"
                type="email"
                dir="ltr"
                defaultValue={tenant?.representativeEmail ?? ""}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" defaultValue={tenant?.notes ?? ""} />
      </div>
    </>
  );
}

export function CreateTenantDialog() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          إضافة مستأجر
        </Button>
      }
      title="إضافة مستأجر جديد"
      action={createTenant}
      submitLabel="إضافة"
    >
      <TenantFields />
    </FormDialog>
  );
}

export function EditTenantDialog({ tenant }: { tenant: Tenant }) {
  const action = updateTenant.bind(null, tenant.id);
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon">
          <Pencil className="size-4" />
        </Button>
      }
      title="تعديل بيانات المستأجر"
      action={action}
      submitLabel="حفظ التعديلات"
    >
      <TenantFields tenant={tenant} />
    </FormDialog>
  );
}
