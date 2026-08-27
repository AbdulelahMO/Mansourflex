"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { createRemittance } from "@/lib/actions/remittances";
import { formatCurrency } from "@/lib/format";
import { Banknote } from "lucide-react";

const METHOD_OPTIONS = ["تحويل بنكي", "نقدي", "شيك"];

/** Records a transfer to the owner against one building's account. */
export function RemittanceDialog({
  buildingId,
  buildingName,
  suggestedAmount,
  triggerLabel = "تسجيل توريد",
}: {
  buildingId: string;
  buildingName: string;
  /** The outstanding balance, offered as the default so the common case is one click. */
  suggestedAmount: number;
  triggerLabel?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultAmount = suggestedAmount > 0 ? Math.round(suggestedAmount * 100) / 100 : "";

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Banknote className="size-4" />
          {triggerLabel}
        </Button>
      }
      title="تسجيل توريد للمالك"
      description={`${buildingName} — المستحق الحالي ${formatCurrency(suggestedAmount)}`}
      action={createRemittance}
      submitLabel="تسجيل وإصدار السند"
    >
      <input type="hidden" name="buildingId" value={buildingId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`amount-${buildingId}`}>
            المبلغ المحوَّل <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`amount-${buildingId}`}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultAmount}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`remittedAt-${buildingId}`}>
            تاريخ التحويل <span className="text-destructive">*</span>
          </Label>
          <Input id={`remittedAt-${buildingId}`} name="remittedAt" type="date" required defaultValue={today} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`method-${buildingId}`}>طريقة التحويل</Label>
          <select
            id={`method-${buildingId}`}
            name="method"
            defaultValue={METHOD_OPTIONS[0]}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reference-${buildingId}`}>رقم العملية / الشيك</Label>
          <Input id={`reference-${buildingId}`} name="reference" dir="ltr" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${buildingId}`}>ملاحظات</Label>
        <Textarea id={`notes-${buildingId}`} name="notes" />
      </div>

      <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        يصدر سند توريد تلقائياً بالمبلغ، ويظهر في المستندات المالية. يمكنك حذفه لاحقاً إن سُجِّل بالخطأ.
      </p>
    </FormDialog>
  );
}
