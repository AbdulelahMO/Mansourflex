"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { createEmployee, updateEmployee, createRole, updateRole } from "@/lib/actions/staff";
import { Plus, Pencil } from "lucide-react";

const selectClass =
  "h-11 w-full rounded-lg border md:h-9 border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

type RoleOption = { id: string; name: string };

type Employee = {
  id: string;
  name: string;
  email: string;
  nationalId: string | null;
  phone: string | null;
  isActive: boolean;
  staffRole: { id: string; name: string } | null;
};

export function EmployeeDialog({ roles, employee }: { roles: RoleOption[]; employee?: Employee }) {
  const isEdit = !!employee;

  return (
    <FormDialog
      trigger={
        isEdit ? (
          <Button variant="ghost" size="icon" title="تعديل الموظف">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            إضافة موظف
          </Button>
        )
      }
      title={isEdit ? "تعديل بيانات الموظف" : "إضافة موظف"}
      description={
        isEdit
          ? "لتغيير كلمة المرور استخدم «إعادة تعيين كلمة المرور» من قائمة الموظف"
          : "يولّد النظام كلمة مرور مؤقتة تُعرض لك مرة واحدة، ويُلزَم الموظف بتغييرها عند أول دخول"
      }
      action={isEdit ? updateEmployee.bind(null, employee.id) : createEmployee}
      submitLabel={isEdit ? "حفظ التعديلات" : "إضافة"}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">
          الاسم <span className="text-destructive">*</span>
        </Label>
        <Input id="name" name="name" required defaultValue={employee?.name} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nationalId">
            رقم الهوية {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="nationalId"
            name="nationalId"
            dir="ltr"
            required={!isEdit}
            pattern="\d{10}"
            title="يتكوّن من 10 أرقام"
            defaultValue={employee?.nationalId ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            الجوال {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="phone"
            name="phone"
            dir="ltr"
            required={!isEdit}
            pattern="05\d{8}"
            title="يبدأ بـ05 ويتكوّن من 10 أرقام"
            placeholder="05xxxxxxxx"
            defaultValue={employee?.phone ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          البريد الإلكتروني <span className="text-destructive">*</span>
        </Label>
        <Input id="email" name="email" type="email" dir="ltr" required defaultValue={employee?.email} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staffRoleId">
          الدور <span className="text-destructive">*</span>
        </Label>
        <select
          id="staffRoleId"
          name="staffRoleId"
          required
          defaultValue={employee?.staffRole?.id ?? ""}
          className={selectClass}
        >
          <option value="">اختر الدور</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={employee?.isActive ?? true}
          className="size-4 accent-primary"
        />
        الحساب نشط ويستطيع الدخول
      </label>
    </FormDialog>
  );
}

type Role = { id: string; name: string; description: string | null; inheritsAll: boolean; isSystem: boolean };

export function RoleDialog({ role }: { role?: Role }) {
  const isEdit = !!role;

  return (
    <FormDialog
      trigger={
        isEdit ? (
          <Button variant="ghost" size="icon" title="تعديل الدور">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            دور جديد
          </Button>
        )
      }
      title={isEdit ? "تعديل الدور" : "دور جديد"}
      action={isEdit ? updateRole.bind(null, role.id) : createRole}
      submitLabel={isEdit ? "حفظ" : "إنشاء"}
    >
      <div className="space-y-1.5">
        <Label htmlFor="roleName">
          اسم الدور <span className="text-destructive">*</span>
        </Label>
        <Input id="roleName" name="name" required defaultValue={role?.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="roleDescription">الوصف</Label>
        <Textarea id="roleDescription" name="description" defaultValue={role?.description ?? ""} />
      </div>

      <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <input
          type="checkbox"
          name="inheritsAll"
          defaultChecked={role?.inheritsAll ?? false}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          «كل شيء ما عدا المستثنى»
          <span className="mt-0.5 block text-xs text-muted-foreground">
            يرث الدور أي شاشة تُضاف للنظام مستقبلاً تلقائياً، عدا الصلاحيات الحسّاسة فتبقى ممنوعة حتى تمنحها
            صراحةً. مناسب لدور نائب المدير.
          </span>
        </span>
      </label>
    </FormDialog>
  );
}
