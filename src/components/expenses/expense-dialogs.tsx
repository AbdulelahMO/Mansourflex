"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_BEARERS } from "@/lib/expenses";
import { toDateInputValue } from "@/lib/format";
import { Plus, Pencil, Paperclip } from "lucide-react";

export type ExpenseBuildingOption = { id: string; name: string };
export type ExpenseUnitOption = { id: string; unitNumber: string; buildingId: string };

export type ExpenseValues = {
  id: string;
  buildingId: string;
  unitId: string | null;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  expenseDate: Date | string;
  paidDate: Date | string | null;
  bearer: string;
  fileUrl: string | null;
  notes: string | null;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring";

function ExpenseFields({
  buildings,
  units,
  expense,
  defaultBuildingId,
}: {
  buildings: ExpenseBuildingOption[];
  units: ExpenseUnitOption[];
  expense?: ExpenseValues;
  defaultBuildingId?: string;
}) {
  const [buildingId, setBuildingId] = useState(expense?.buildingId ?? defaultBuildingId ?? "");
  const [unitId, setUnitId] = useState(expense?.unitId ?? "");
  const [paidDate, setPaidDate] = useState(toDateInputValue(expense?.paidDate));

  // Only the chosen building's units can carry its expense.
  const buildingUnits = units.filter((u) => u.buildingId === buildingId);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="buildingId">
            المبنى <span className="text-destructive">*</span>
          </Label>
          <select
            id="buildingId"
            name="buildingId"
            required
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setUnitId(""); // units belong to the previous building
            }}
            className={selectClass}
          >
            <option value="">اختر المبنى</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitId">الوحدة</Label>
          <select
            id="unitId"
            name="unitId"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={selectClass}
            disabled={!buildingId}
          >
            <option value="">مصروف عام على المبنى</option>
            {buildingUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">
            التصنيف <span className="text-destructive">*</span>
          </Label>
          <select id="category" name="category" defaultValue={expense?.category ?? "MAINTENANCE"} className={selectClass}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bearer">جهة التحمل</Label>
          <select id="bearer" name="bearer" defaultValue={expense?.bearer ?? "OWNER"} className={selectClass}>
            {EXPENSE_BEARERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          الوصف <span className="text-destructive">*</span>
        </Label>
        <Input id="description" name="description" required defaultValue={expense?.description ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">
            المبلغ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={expense?.amount ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor">المورّد</Label>
          <Input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="expenseDate">
            تاريخ الفاتورة <span className="text-destructive">*</span>
          </Label>
          <Input
            id="expenseDate"
            name="expenseDate"
            type="date"
            required
            defaultValue={toDateInputValue(expense?.expenseDate) || new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paidDate">تاريخ الصرف</Label>
          <Input
            id="paidDate"
            name="paidDate"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {paidDate ? "مدفوع — يُخصم في فترة هذا التاريخ" : "اتركه فارغاً إن لم يُصرف بعد"}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expenseFile" className="flex items-center gap-1.5">
          <Paperclip className="size-3.5" />
          فاتورة المورّد (PDF أو صورة)
        </Label>
        <Input id="expenseFile" name="expenseFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
        {expense?.fileUrl && (
          <a
            href={`/api/files/${expense.fileUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-primary hover:underline"
          >
            عرض الملف الحالي
          </a>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" defaultValue={expense?.notes ?? ""} />
      </div>
    </>
  );
}

export function CreateExpenseDialog({
  buildings,
  units,
  defaultBuildingId,
  trigger,
}: {
  buildings: ExpenseBuildingOption[];
  units: ExpenseUnitOption[];
  defaultBuildingId?: string;
  trigger?: React.ReactNode;
}) {
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button>
            <Plus className="size-4" />
            تسجيل مصروف
          </Button>
        )
      }
      title="تسجيل مصروف"
      description="المصروف الذي يتحمله المالك ويُصرف فعلاً يُخصم من تسويته قبل احتساب عمولة الإدارة"
      action={createExpense}
      submitLabel="حفظ"
    >
      <ExpenseFields buildings={buildings} units={units} defaultBuildingId={defaultBuildingId} />
    </FormDialog>
  );
}

export function EditExpenseDialog({
  expense,
  buildings,
  units,
}: {
  expense: ExpenseValues;
  buildings: ExpenseBuildingOption[];
  units: ExpenseUnitOption[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" title="تعديل المصروف">
          <Pencil className="size-4" />
        </Button>
      }
      title="تعديل المصروف"
      action={updateExpense.bind(null, expense.id)}
      submitLabel="حفظ التعديلات"
    >
      <ExpenseFields buildings={buildings} units={units} expense={expense} />
    </FormDialog>
  );
}
