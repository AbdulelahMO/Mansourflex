import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/contracts/print-button";
import { formatCurrency, formatDateNumeric } from "@/lib/format";
import { amountToArabicWords } from "@/lib/number-to-arabic-words";

type Doc = {
  documentNumber: string;
  issueDate: Date;
  status?: string;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  amount: number;
  commission: {
    method: string | null;
    reference: string | null;
    notes: string | null;
    owner: { name: string; nationalId: string | null; unifiedNumber: string | null; ownerType: string | null };
    building: { name: string; city: string | null; district: string | null };
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

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

/**
 * سند قبض عمولة — evidence that the management fee was received from the owner.
 *
 * Its mirror, the remittance voucher, records money going out to the owner; this records the fee
 * coming back in, which only happens when the rent went straight to them and there was nothing in
 * hand to keep the fee out of. Both are numbered, printed and cancelled the same way, because the
 * house rule does not change with the direction: no riyal moves without a voucher.
 */
export function CommissionReceiptDocument({ doc, org }: { doc: Doc; org: Org }) {
  const { commission } = doc;
  const { owner, building } = commission;
  const isCompany = owner.ownerType === "COMPANY";
  const place = [building.city, building.district].filter(Boolean).join("، ");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
          العودة للمستندات
        </Link>
        <PrintButton />
      </div>

      {/* CANCELLED_BANNER */}
      {doc.status === "CANCELLED" && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-center">
          <p className="text-lg font-bold text-red-700">هذا المستند ملغى</p>
          <p className="text-xs text-red-700">
            أُلغي بتاريخ {doc.cancelledAt ? formatDateNumeric(doc.cancelledAt) : "—"}
            {doc.cancelReason ? ` — ${doc.cancelReason}` : ""}
          </p>
        </div>
      )}

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div className="space-y-0.5 text-sm">
              <p className="text-base font-bold">{org?.name ?? "—"}</p>
              {org?.commercialRegister && <p className="text-muted-foreground">السجل التجاري: {org.commercialRegister}</p>}
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
            <h1 className="text-xl font-bold">سند قبض أتعاب إدارة</h1>
            <p className="text-xs text-muted-foreground">Management Fee Receipt</p>
          </div>

          <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span>
              <span className="text-muted-foreground">رقم السند: </span>
              <span className="font-bold" dir="ltr">
                {doc.documentNumber}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">تاريخ الاستلام: </span>
              <span className="font-medium">{formatDateNumeric(doc.issueDate)}</span>
            </span>
          </div>

          <p className="text-sm leading-7">
            استلمنا من المالك <span className="font-bold">{owner.name}</span> مبلغاً وقدره{" "}
            <span className="font-bold">{formatCurrency(doc.amount)}</span> ({amountToArabicWords(doc.amount)} لا غير)،
            وذلك عن أتعاب إدارة عقار <span className="font-bold">{building.name}</span>
            {place ? ` بـ${place}` : ""}، وتُخصم من مستحقات الإدارة عليه.
          </p>

          <div>
            <Row label={isCompany ? "الرقم الموحد" : "رقم هوية المالك"} value={isCompany ? owner.unifiedNumber : owner.nationalId} />
            <Row label="العقار" value={`${building.name}${place ? ` — ${place}` : ""}`} />
            <Row label="طريقة الاستلام" value={commission.method} />
            <Row label="رقم العملية / الشيك" value={commission.reference} />
          </div>

          {commission.notes && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">ملاحظات</p>
              <p className="mt-1 whitespace-pre-wrap">{commission.notes}</p>
            </div>
          )}

          <div className="grid gap-8 pt-8 sm:grid-cols-2">
            <div className="space-y-8 text-center">
              <p className="text-sm font-bold">المسلِّم (المالك)</p>
              <p className="text-sm">{owner.name}</p>
              <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
            </div>
            <div className="space-y-8 text-center">
              <p className="text-sm font-bold">المستلِم — مدير الأملاك</p>
              <p className="text-sm">{org?.signatoryName ?? org?.name ?? "—"}</p>
              <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
