"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { updateCollectionDetails } from "@/lib/actions/payments";
import { formatCurrency } from "@/lib/format";
import { PencilLine } from "lucide-react";

const PAYMENT_METHOD_OPTIONS = ["تحويل بنكي", "نقدي", "شبكة", "سداد عبر منصة إيجار"];

const RECIPIENT_OPTIONS = [
  { value: "OPERATOR", label: "المشغل" },
  { value: "OWNER", label: "المالك" },
];

/**
 * Corrects how a collection was recorded, never how much. The amount is settled by receipts,
 * so changing it means reversing the collection instead — a mistyped reference does not.
 */
export function EditCollectionDialog({
  paymentId,
  paidAmount,
  paidDate,
  method,
  recipient,
  reference,
  notes,
}: {
  paymentId: string;
  paidAmount: number;
  /** ISO date (yyyy-mm-dd) as stored, so no timezone shifts it a day. */
  paidDate: string;
  method: string | null;
  recipient: string | null;
  reference: string | null;
  notes: string | null;
}) {
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="ghost" title="تعديل بيانات التحصيل">
          <PencilLine className="size-4" />
        </Button>
      }
      title="تعديل بيانات التحصيل"
      description={`المحصّل ${formatCurrency(paidAmount)} — يُعدَّل تاريخه وطريقته ومرجعه، أما المبلغ فيُغيَّر بالتراجع عن التحصيل وتسجيله من جديد.`}
      action={updateCollectionDetails.bind(null, paymentId)}
      submitLabel="حفظ"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`paidDate-${paymentId}`}>تاريخ الدفع</Label>
          <Input id={`paidDate-${paymentId}`} name="paidDate" type="date" required defaultValue={paidDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`recipient-${paymentId}`}>المستلم</Label>
          <Select name="recipient" defaultValue={recipient ?? "OPERATOR"}>
            <SelectTrigger id={`recipient-${paymentId}`} className="w-full">
              <SelectValue placeholder="اختر المستلم" />
            </SelectTrigger>
            <SelectContent>
              {RECIPIENT_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`method-${paymentId}`}>طريقة الدفع</Label>
        <Select name="method" defaultValue={method ?? undefined}>
          <SelectTrigger id={`method-${paymentId}`} className="w-full">
            <SelectValue placeholder="اختر طريقة الدفع" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`reference-${paymentId}`}>رقم العملية / المرجع</Label>
        <Input id={`reference-${paymentId}`} name="reference" dir="ltr" defaultValue={reference ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${paymentId}`}>ملاحظات</Label>
        <Textarea id={`notes-${paymentId}`} name="notes" defaultValue={notes ?? ""} />
      </div>
    </FormDialog>
  );
}
