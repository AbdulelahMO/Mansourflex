import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/contracts/print-button";
import { formatCurrency, formatDateNumeric } from "@/lib/format";
import { amountToArabicWords } from "@/lib/number-to-arabic-words";
import { CATEGORY_LABELS, BEARER_LABELS } from "@/lib/expenses";

type Voucher = {
  documentNumber: string;
  issueDate: Date;
  amount: number;
  notes: string | null;
  expense: {
    description: string;
    category: string;
    bearer: string;
    vendor: string | null;
    expenseDate: Date;
    paidDate: Date | null;
    notes: string | null;
    building: { name: string; city: string | null; district: string | null; owner: { name: string } };
    unit: { unitNumber: string } | null;
  };
};

type Org = {
  name: string | null;
  logoUrl: string | null;
  commercialRegister: string | null;
  phone: string | null;
  address: string | null;
  signatoryName: string | null;
} | null;

function Row({ label, value, bold }: { label: string; value: string | null | undefined; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b py-2 text-sm last:border-b-0 ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

/** سند صرف — the disbursement counterpart of a receipt: it evidences money paid out, not collected. */
export function ExpenseVoucherDocument({ voucher, org }: { voucher: Voucher; org: Org }) {
  const { expense } = voucher;
  const place = [expense.building.city, expense.building.district].filter(Boolean).join("، ");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
          العودة للمصروفات
        </Link>
        <PrintButton />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div className="space-y-0.5 text-sm">
              <p className="text-base font-bold">{org?.name ?? "—"}</p>
              {org?.commercialRegister && (
                <p className="text-muted-foreground">السجل التجاري: {org.commercialRegister}</p>
              )}
              {org?.phone && (
                <p className="text-muted-foreground" dir="ltr">
                  {org.phone}
                </p>
              )}
              {org?.address && <p className="text-muted-foreground">{org.address}</p>}
            </div>
            {org?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${org.logoUrl}`} alt="" className="h-16 w-auto shrink-0 object-contain" />
            )}
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold">سند صرف</h1>
            <p className="text-xs text-muted-foreground">Payment Voucher</p>
          </div>

          <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span>
              <span className="text-muted-foreground">رقم السند: </span>
              <span className="font-bold" dir="ltr">
                {voucher.documentNumber}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">تاريخ الصرف: </span>
              <span className="font-medium">{formatDateNumeric(voucher.issueDate)}</span>
            </span>
          </div>

          <div>
            <Row label="صُرف إلى" value={expense.vendor || "—"} />
            <Row label="مبلغ وقدره" value={formatCurrency(voucher.amount)} bold />
            <Row label="فقط" value={`${amountToArabicWords(voucher.amount)} لا غير`} />
            <Row label="وذلك عن" value={expense.description} />
            <Row label="التصنيف" value={CATEGORY_LABELS[expense.category]} />
            <Row label="العقار" value={`${expense.building.name}${place ? ` — ${place}` : ""}`} />
            {expense.unit && <Row label="الوحدة" value={expense.unit.unitNumber} />}
            <Row label="جهة التحمل" value={BEARER_LABELS[expense.bearer]} />
            <Row label="مالك العقار" value={expense.building.owner.name} />
            <Row label="تاريخ فاتورة المورّد" value={formatDateNumeric(expense.expenseDate)} />
          </div>

          {(voucher.notes || expense.notes) && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">ملاحظات</p>
              <p className="mt-1 whitespace-pre-wrap">{voucher.notes || expense.notes}</p>
            </div>
          )}

          <div className="grid gap-8 pt-8 sm:grid-cols-2">
            <div className="space-y-8 text-center">
              <p className="text-sm font-bold">المستلم</p>
              <p className="text-sm">{expense.vendor ?? "—"}</p>
              <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
            </div>
            <div className="space-y-8 text-center">
              <p className="text-sm font-bold">أمين الصندوق</p>
              <p className="text-sm">{org?.signatoryName ?? org?.name ?? "—"}</p>
              <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
