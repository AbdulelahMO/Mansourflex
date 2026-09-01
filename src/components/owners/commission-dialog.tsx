"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { createCommissionCollection } from "@/lib/actions/commission";
import { formatCurrency } from "@/lib/format";
import { HandCoins } from "lucide-react";

const METHOD_OPTIONS = ["تحويل بنكي", "نقدي", "شيك", "خصم من تحصيل لاحق"];

/**
 * Records management fees received from the owner — the case where the rent went straight to
 * them, so there was never any of their money in hand to keep the fee out of.
 */
export function CommissionDialog({
  buildingId,
  buildingName,
  unsettledAmount,
  triggerLabel = "تسجيل قبض أتعاب",
}: {
  buildingId: string;
  buildingName: string;
  /** What is earned and not yet settled, offered as the default so the common case is one click. */
  unsettledAmount: number;
  triggerLabel?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const due = Math.round(unsettledAmount * 100) / 100;

  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [acknowledged, setAcknowledged] = useState(false);
  const exceeds = Number(amount || 0) > due + 0.5;

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <HandCoins className="size-4" />
          {triggerLabel}
        </Button>
      }
      title="تسجيل قبض أتعاب الإدارة"
      description={
        due > 0.5
          ? `${buildingName} — أتعاب لم تُسوَّ ${formatCurrency(unsettledAmount)}`
          : `${buildingName} — لا توجد أتعاب غير مسوّاة`
      }
      action={createCommissionCollection}
      submitLabel="تسجيل وإصدار السند"
    >
      <input type="hidden" name="buildingId" value={buildingId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`camount-${buildingId}`}>
            المبلغ المقبوض <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`camount-${buildingId}`}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`collectedAt-${buildingId}`}>
            تاريخ الاستلام <span className="text-destructive">*</span>
          </Label>
          <Input id={`collectedAt-${buildingId}`} name="collectedAt" type="date" required defaultValue={today} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cmethod-${buildingId}`}>طريقة الاستلام</Label>
          <select
            id={`cmethod-${buildingId}`}
            name="method"
            defaultValue={METHOD_OPTIONS[0]}
            className="h-11 w-full rounded-lg border md:h-9 border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`creference-${buildingId}`}>رقم العملية / الشيك</Label>
          <Input id={`creference-${buildingId}`} name="reference" dir="ltr" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`cnotes-${buildingId}`}>ملاحظات</Label>
        <Textarea id={`cnotes-${buildingId}`} name="notes" placeholder="مثلاً: أتعاب إيجار الوحدة 101 الذي استلمه المالك" />
      </div>

      {exceeds && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            {due > 0.5
              ? `المبلغ يتجاوز الأتعاب غير المسوّاة عن هذا العقار (${formatCurrency(unsettledAmount)}). ما زاد عن ذلك يخصّ عقاراً آخر أو سبق خصمه من توريد سابق — ولكل عقار سنده.`
              : "لا توجد أتعاب غير مسوّاة على هذا العقار — سُوّيت كلها بسند. سجّل القبض فقط إن كان المالك قد سلّمك مبلغاً بالفعل."}
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
              required
            />
            <span>أعلم بذلك وأريد تسجيل المبلغ كاملاً على هذا العقار</span>
          </label>
        </div>
      )}

      <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        يصدر سند قبض عمولة بالمبلغ ويظهر في المستندات المالية، فيبقى للأتعاب أثرٌ مستندي كأي ريال في النظام.
        ويمكن إلغاؤه لاحقاً فيعود المبلغ ديناً على المالك.
      </p>
    </FormDialog>
  );
}
