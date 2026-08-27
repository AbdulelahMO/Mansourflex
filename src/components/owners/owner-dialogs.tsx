"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { createOwner, updateOwner } from "@/lib/actions/owners";
import { Plus, Pencil } from "lucide-react";

type Owner = {
  id: string;
  name: string;
  ownerType: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  taxNumber: string | null;
  unifiedNumber: string | null;
  representativeName: string | null;
  representativeNationalId: string | null;
  representativePhone: string | null;
  representativeEmail: string | null;
  notes: string | null;
};

const OWNER_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "فرد" },
  { value: "COMPANY", label: "شركة / مؤسسة" },
];

function OwnerTypeField({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="ownerType">نوع المالك</Label>
      <Select name="ownerType" value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger className="w-full" id="ownerType">
          <SelectValue placeholder="اختر نوع المالك" />
        </SelectTrigger>
        <SelectContent>
          {OWNER_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RepresentativeFields({ owner }: { owner?: Owner }) {
  return (
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
            defaultValue={owner?.representativeName ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="representativeNationalId">رقم الهوية</Label>
          <Input
            id="representativeNationalId"
            name="representativeNationalId"
            dir="ltr"
            defaultValue={owner?.representativeNationalId ?? ""}
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
            defaultValue={owner?.representativePhone ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="representativeEmail">البريد الإلكتروني</Label>
          <Input
            id="representativeEmail"
            name="representativeEmail"
            type="email"
            dir="ltr"
            defaultValue={owner?.representativeEmail ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

export function CreateOwnerDialog() {
  const [createLogin, setCreateLogin] = useState(false);
  const [ownerType, setOwnerType] = useState("");
  const isCompany = ownerType === "COMPANY";

  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          إضافة مالك
        </Button>
      }
      title="إضافة مالك جديد"
      action={createOwner}
      submitLabel="إضافة"
    >
      <OwnerTypeField value={ownerType} onValueChange={setOwnerType} />
      <div className="space-y-1.5">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            الجوال<span className="text-destructive"> *</span>
          </Label>
          <Input id="phone" name="phone" dir="ltr" required pattern="\d{10}" title="يتكون من 10 أرقام" />
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
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="nationalId">
              رقم الهوية<span className="text-destructive"> *</span>
            </Label>
            <Input id="nationalId" name="nationalId" dir="ltr" required pattern="\d{10}" title="يتكون من 10 أرقام" />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">
          البريد الإلكتروني<span className="text-destructive"> *</span>
        </Label>
        <Input id="email" name="email" type="email" required dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="taxNumber">الرقم الضريبي</Label>
        <Input id="taxNumber" name="taxNumber" dir="ltr" placeholder="اتركه فارغاً إن لم يوجد رقم ضريبي" />
        <p className="text-xs text-muted-foreground">
          عند وجود رقم ضريبي تصدر فواتير هذا المالك كفواتير ضريبية تلقائياً، وإلا تصدر كفواتير عادية
        </p>
      </div>
      {isCompany && <RepresentativeFields />}
      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">إنشاء حساب دخول للمالك</p>
          <p className="text-xs text-muted-foreground">يتيح للمالك تسجيل الدخول لعرض أملاكه فقط</p>
        </div>
        <Switch name="createLogin" checked={createLogin} onCheckedChange={setCreateLogin} />
      </div>
      {createLogin && (
        <div className="space-y-1.5">
          <Label htmlFor="password">كلمة المرور</Label>
          <PasswordInput id="password" name="password" minLength={8} required={createLogin} />
        </div>
      )}
    </FormDialog>
  );
}

export function EditOwnerDialog({ owner }: { owner: Owner }) {
  const action = updateOwner.bind(null, owner.id);
  const [ownerType, setOwnerType] = useState(owner.ownerType ?? "");
  const isCompany = ownerType === "COMPANY";

  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon">
          <Pencil className="size-4" />
        </Button>
      }
      title="تعديل بيانات المالك"
      action={action}
      submitLabel="حفظ التعديلات"
    >
      <OwnerTypeField value={ownerType} onValueChange={setOwnerType} />
      <div className="space-y-1.5">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" name="name" required defaultValue={owner.name} />
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
            defaultValue={owner.phone ?? ""}
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
              defaultValue={owner.unifiedNumber ?? ""}
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
              defaultValue={owner.nationalId ?? ""}
            />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">
          البريد الإلكتروني<span className="text-destructive"> *</span>
        </Label>
        <Input id="email" name="email" type="email" required dir="ltr" defaultValue={owner.email ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="taxNumber">الرقم الضريبي</Label>
        <Input id="taxNumber" name="taxNumber" dir="ltr" defaultValue={owner.taxNumber ?? ""} placeholder="اتركه فارغاً إن لم يوجد رقم ضريبي" />
        <p className="text-xs text-muted-foreground">
          عند وجود رقم ضريبي تصدر فواتير هذا المالك كفواتير ضريبية تلقائياً، وإلا تصدر كفواتير عادية
        </p>
      </div>
      {isCompany && <RepresentativeFields owner={owner} />}
      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" defaultValue={owner.notes ?? ""} />
      </div>
    </FormDialog>
  );
}
