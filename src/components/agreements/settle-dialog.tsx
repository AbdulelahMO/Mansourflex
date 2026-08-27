"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { settleAndTerminateAgreement } from "@/lib/actions/agreements";
import { formatCurrency } from "@/lib/format";
import { CircleAlert, Scale } from "lucide-react";

export type SettlementNumbers = {
  collected: number;
  ownerExpenses: number;
  netCollected: number;
  commissionPercent: number;
  commission: number;
  operatorExpenses: number;
  netCommission: number;
  payableToOwner: number;
  pendingArrears: number;
  pendingExpenses: number;
};

function Row({
  label,
  value,
  strong,
  muted,
  href,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  /** Turns the figure into a link to the records behind it. */
  href?: string;
}) {
  return (
    <div className={"flex items-center justify-between " + (strong ? "border-t pt-2 font-bold" : "")}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      {href ? (
        <Link href={href} className="tabular-nums underline underline-offset-4 hover:no-underline">
          {value}
        </Link>
      ) : (
        <span className={"tabular-nums " + (muted ? "text-muted-foreground" : "")}>{value}</span>
      )}
    </div>
  );
}

export function SettleAgreementDialog({
  agreementId,
  preview,
  unpaidExpensesHref,
}: {
  agreementId: string;
  preview: SettlementNumbers;
  /** Expenses page filtered to this building's unpaid records. */
  unpaidExpensesHref: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const hasPending = preview.pendingArrears > 0 || preview.pendingExpenses > 0;
  // A negative commission means the account ran backwards; the figures stand, but they deserve a second look.
  const negativeCommission = preview.commission < 0 || preview.netCommission < 0;

  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <Scale className="size-4" />
          تصفية وإنهاء
        </Button>
      }
      title="تصفية الاتفاقية وإنهاؤها"
      description="تُحفظ الأرقام أدناه ككشف ثابت لا يتغيّر بعد الإنهاء، وتُصبح الاتفاقية مفسوخة"
      action={settleAndTerminateAgreement.bind(null, agreementId)}
      submitLabel="اعتماد التصفية والإنهاء"
    >
      <div className="space-y-1.5">
        <Label htmlFor="settledAt">
          تاريخ الإنهاء <span className="text-destructive">*</span>
        </Label>
        <Input id="settledAt" name="settledAt" type="date" required defaultValue={today} />
        <p className="text-xs text-muted-foreground">
          تُحتسب التصفية على ما حُصّل وصُرف حتى هذا التاريخ. تغييره يستلزم إعادة فتح النافذة لتحديث الأرقام.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <p className="font-semibold">كشف التصفية</p>
        <Row label="المحصّل" value={formatCurrency(preview.collected)} />
        <Row label="− مصروفات على المالك" value={formatCurrency(preview.ownerExpenses)} muted />
        <Row label="صافي المحصّل" value={formatCurrency(preview.netCollected)} strong />
        <Row label={`− عمولة الإدارة ${preview.commissionPercent}%`} value={formatCurrency(preview.commission)} muted />
        <Row label="المستحق توريده للمالك" value={formatCurrency(preview.payableToOwner)} strong />
      </div>

      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <p className="font-semibold">حصة مدير الأملاك</p>
        <Row label="عمولة الإدارة" value={formatCurrency(preview.commission)} />
        <Row label="− مصروفات تحمّلها المشغل" value={formatCurrency(preview.operatorExpenses)} muted />
        <Row label="صافي العمولة" value={formatCurrency(preview.netCommission)} strong />
      </div>

      {negativeCommission && (
        <div className="space-y-1.5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <CircleAlert className="size-4" />
            تنبيه: العمولة بالسالب
          </p>
          <p className="text-xs leading-6">
            {preview.commission < 0
              ? "مصروفات المالك خلال الفترة تجاوزت ما حُصّل، فجاء صافي المحصّل سالباً وتبعته العمولة. راجع المبالغ المحصّلة والمصروفات المسجّلة قبل الاعتماد."
              : "المصروفات التي تحمّلها المشغل تجاوزت العمولة المستحقة. راجع مصروفات المشغل قبل الاعتماد."}
          </p>
        </div>
      )}

      {hasPending && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-amber-800">
            <CircleAlert className="size-4" />
            بنود معلّقة — تُوثّق ولا تدخل الحساب
          </p>
          {preview.pendingArrears > 0 && (
            <Row label="متأخرات لم تُحصّل" value={formatCurrency(preview.pendingArrears)} />
          )}
          {preview.pendingExpenses > 0 && (
            <Row label="مصروفات لم تُدفع" value={formatCurrency(preview.pendingExpenses)} href={unpaidExpensesHref} />
          )}
          <p className="text-xs text-amber-800">
            يمكنك الإنهاء رغم وجودها، وتبقى مسجّلة في الكشف للرجوع إليها عند تحصيلها أو سدادها.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات التصفية</Label>
        <Textarea id="notes" name="notes" placeholder="مثال: سُلّمت المفاتيح والمستندات للمالك" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">سبب الطلب</Label>
        <Textarea id="reason" name="reason" placeholder="يُطلب فقط إن كانت صلاحيتك تحتاج موافقة المدير" />
      </div>
    </FormDialog>
  );
}
