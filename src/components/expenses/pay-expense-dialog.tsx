"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { payExpense } from "@/lib/actions/expenses";
import { formatCurrency } from "@/lib/format";
import { Banknote } from "lucide-react";

/**
 * Settling a supplier invoice: an expense is paid in full in one go, so the only figure
 * needed is the date the money left — the amount is the expense itself.
 */
export function PayExpenseDialog({
  expenseId,
  amount,
  vendor,
  expenseDate,
}: {
  expenseId: string;
  amount: number;
  vendor: string | null;
  /** The invoice date — the disbursement cannot predate it. */
  expenseDate: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline" title="سداد المصروف">
          <Banknote className="size-4" />
          سداد
        </Button>
      }
      title="سداد المصروف"
      description={`صرف ${formatCurrency(amount)}${vendor ? ` إلى ${vendor}` : ""} — يُسدَّد المصروف بكامل مبلغه`}
      action={payExpense.bind(null, expenseId)}
      submitLabel="تأكيد السداد"
    >
      <div className="space-y-1.5">
        <Label htmlFor="paidDate">
          تاريخ الصرف <span className="text-destructive">*</span>
        </Label>
        <Input id="paidDate" name="paidDate" type="date" required min={expenseDate} defaultValue={today} />
        <p className="text-xs text-muted-foreground">
          يُخصم المصروف في فترة هذا التاريخ عند احتساب عمولة الإدارة والتصفية.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" placeholder="مثال: تحويل بنكي — مرجع 4471" />
      </div>

      <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <input type="checkbox" id="issueVoucher" name="issueVoucher" defaultChecked className="mt-0.5 size-4 accent-primary" />
        <span>
          إصدار سند صرف تلقائياً بالمبلغ
          <span className="mt-0.5 block text-xs text-muted-foreground">
            سند واحد لكل مصروف. يمكنك حذفه لاحقاً وإعادة إصداره عند الحاجة.
          </span>
        </span>
      </label>
    </FormDialog>
  );
}
