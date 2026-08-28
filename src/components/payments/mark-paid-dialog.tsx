"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { markPaymentPaid } from "@/lib/actions/payments";
import { Banknote } from "lucide-react";

const PAYMENT_METHOD_OPTIONS = ["تحويل بنكي", "نقدي", "شبكة", "سداد عبر منصة إيجار"];

/** من استلم المبلغ فعلياً — يفرّق بين ما حصّلته الإدارة وما قبضه المالك مباشرة. */
const RECIPIENT_OPTIONS = [
  { value: "OPERATOR", label: "المشغل" },
  { value: "OWNER", label: "المالك" },
];

export function MarkPaidDialog({ paymentId, amount }: { paymentId: string; amount: number }) {
  const action = markPaymentPaid.bind(null, paymentId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline" title="تسجيل دفعة">
          <Banknote className="size-4" />
        </Button>
      }
      title="تسجيل دفعة"
      description="أدخل المبلغ المستلم في هذه العملية فقط — يُضاف إلى أي مبلغ سابق، وأي فائض يُرحَّل تلقائياً إلى الدفعات القادمة في نفس العقد"
      action={action}
      submitLabel="تأكيد"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="paidAmount">المبلغ المستلم الآن</Label>
          <Input id="paidAmount" name="paidAmount" type="number" step="0.01" required defaultValue={amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paidDate">تاريخ الدفع</Label>
          <Input id="paidDate" name="paidDate" type="date" required defaultValue={today} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="method">طريقة الدفع</Label>
        <Select name="method">
          <SelectTrigger id="method" className="w-full">
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
        <Label htmlFor="recipient">المستلم</Label>
        <Select name="recipient" defaultValue="OPERATOR">
          <SelectTrigger id="recipient" className="w-full">
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
      <div className="space-y-1.5">
        <Label htmlFor="reference">المرجع</Label>
        <Input id="reference" name="reference" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <input
          type="checkbox"
          id="issueReceipt"
          name="issueReceipt"
          defaultChecked
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          إصدار سند قبض تلقائياً بالمبلغ المستلم
          <span className="mt-0.5 block text-xs text-muted-foreground">
            وتصدر معه فاتورة القسط إن لم تكن صدرت من قبل، فالسند إقرار بالسداد مقابلها.
          </span>
        </span>
      </label>
    </FormDialog>
  );
}
