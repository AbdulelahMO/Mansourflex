import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateNumeric } from "@/lib/format";
import { amountToArabicWords } from "@/lib/number-to-arabic-words";
import { PrintButton } from "@/components/contracts/print-button";
import { ExpenseVoucherDocument } from "@/components/expenses/expense-voucher-document";
import { RemittanceDocument } from "@/components/owners/remittance-document";

const DOCUMENT_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  INVOICE: { ar: "فاتورة", en: "Invoice" },
  RECEIPT: { ar: "سند قبض", en: "Receipt" },
};

const DOCUMENT_TAX_SUFFIX: Record<string, { ar: string; en: string }> = {
  INVOICE: { ar: " ضريبية", en: "Tax " },
  RECEIPT: { ar: " ضريبي", en: "Tax " },
};

function Row({ label, value, bold }: { label: string; value: string | number | null | undefined; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b py-2 text-sm last:border-b-0 ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function FinancialDocumentPage(props: PageProps<"/documents/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const scope = buildingScope(user);

  // A disbursement voucher hangs off an expense, not a contract, so it has its own document layout.
  const voucher = await prisma.financialDocument.findFirst({
    where: { id, type: "PAYMENT_VOUCHER", expense: { building: scope } },
    include: { expense: { include: { building: { include: { owner: true } }, unit: true } } },
  });
  if (voucher?.expense) {
    const org = await prisma.organizationSettings.findUnique({ where: { id: "default" } });
    return <ExpenseVoucherDocument voucher={{ ...voucher, expense: voucher.expense }} org={org} />;
  }

  const remittanceDoc = await prisma.financialDocument.findFirst({
    where: { id, type: "OWNER_REMITTANCE", remittance: { building: scope } },
    include: { remittance: { include: { owner: true, building: true } } },
  });
  if (remittanceDoc?.remittance) {
    const org = await prisma.organizationSettings.findUnique({ where: { id: "default" } });
    return <RemittanceDocument doc={{ ...remittanceDoc, remittance: remittanceDoc.remittance }} org={org} />;
  }

  const doc = await prisma.financialDocument.findFirst({
    where: { id, contract: { unit: { building: scope } } },
    include: {
      payment: { include: { documents: true } },
      contract: {
        include: {
          tenant: true,
          payments: { orderBy: { dueDate: "asc" } },
          unit: { include: { building: { include: { owner: true } } } },
        },
      },
    },
  });
  if (!doc?.contract || !doc.payment) notFound();

  const org = await prisma.organizationSettings.findUnique({ where: { id: "default" } });

  const { contract, payment } = doc;
  const { unit, tenant } = contract;
  const { building } = unit;
  const { owner } = building;

  const isInvoice = doc.type === "INVOICE";
  const vatRate = contract.vatRate;
  const baseAmount = doc.hasTax && vatRate > 0 ? doc.amount / (1 + vatRate / 100) : doc.amount;
  const vatAmount = doc.amount - baseAmount;

  const companyName = org?.name || owner.name;
  const companyPhone = org?.phone || owner.phone;

  const addressParts = [building.city, building.district].filter(Boolean);
  const propertyAddress = addressParts.length ? addressParts.join("، ") : building.address;

  const installmentIndex = contract.payments.findIndex((p) => p.id === payment.id) + 1;
  const nextPayment = contract.payments[installmentIndex]; // next in the ascending list (0-based)
  const periodStart = payment.dueDate;
  const periodEnd = nextPayment
    ? new Date(new Date(nextPayment.dueDate).getTime() - 24 * 60 * 60 * 1000)
    : contract.endDate;

  const serviceDescriptionAr = `إيجار مستحق للدفعة ${installmentIndex} للفترة ${formatDateNumeric(periodStart)} - ${formatDateNumeric(periodEnd)}`;
  const serviceDescriptionEn = `Rent due for installment ${installmentIndex} for ${formatDateNumeric(periodStart)} - ${formatDateNumeric(periodEnd)}`;

  const relatedInvoices = payment.documents.filter((d) => d.type === "INVOICE");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/contracts/${contract.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
          العودة للعقد
        </Link>
        <PrintButton />
      </div>

      {/* CANCELLED_BANNER — يظهر في الشاشة وفي الطباعة معاً */}
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
              <p className="text-base font-bold">{companyName}</p>
              {org?.commercialRegister && <p className="text-muted-foreground">السجل التجاري: {org.commercialRegister}</p>}
              {companyPhone && (
                <p className="text-muted-foreground" dir="ltr">
                  {companyPhone}
                </p>
              )}
              {org?.address && <p className="text-muted-foreground">{org.address}</p>}
            </div>
            {org?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${org.logoUrl}`} alt={companyName} className="h-16 w-auto shrink-0 object-contain" />
            )}
          </div>

          {doc.status === "DRAFT" && (
            <p className="text-center text-sm font-medium text-amber-600">
              مسودة
              <br />
              <span className="text-xs">Draft</span>
            </p>
          )}

          <div className="grid grid-cols-3 items-start gap-2">
            <div className="text-sm text-muted-foreground">
              <p>التاريخ الإصدار: {formatDateNumeric(doc.issueDate)}</p>
              {isInvoice && <p>التاريخ الإستحقاق: {formatDateNumeric(payment.dueDate)}</p>}
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold">
                {DOCUMENT_TYPE_LABELS[doc.type].ar}
                {doc.hasTax && DOCUMENT_TAX_SUFFIX[doc.type].ar}
              </h1>
              <p className="text-sm text-muted-foreground">
                {doc.hasTax && DOCUMENT_TAX_SUFFIX[doc.type].en}
                {DOCUMENT_TYPE_LABELS[doc.type].en}
              </p>
            </div>
            <p className="text-left font-semibold text-orange-600" dir="ltr">
              {doc.documentNumber}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">بيانات العميل</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
              <InfoTile label="الإسم" value={tenant.name} />
              <InfoTile label="الهاتف" value={tenant.phone} />
              {isInvoice && <InfoTile label="السجل التجاري" value={tenant.commercialRegister} />}
              <InfoTile label="رقم عقد إيجار" value={contract.ejarContractNumber} />
              <InfoTile label="رقم العقد" value={contract.contractNumber} />
              <InfoTile label="الوحدة" value={unit.unitNumber} />
              <InfoTile label="العنوان" value={propertyAddress} />
              {!isInvoice && (
                <InfoTile
                  label="للفواتير التالية"
                  value={relatedInvoices.length > 0 ? relatedInvoices.map((inv) => inv.documentNumber).join("، ") : null}
                />
              )}
            </div>
          </div>

          {!isInvoice && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>
                تم استلام مبلغ وقدره {amountToArabicWords(doc.amount)} من العميل: {tenant.name} مقابل للخدمات المقدمة أدناه
              </p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                The sum of {formatCurrency(doc.amount)} has been received from the Customer: {tenant.name}, for the
                services rendered below
              </p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">تفاصيل الخدمات</p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  {isInvoice ? (
                    <TableRow>
                      <TableHead className="w-1/2">
                        الوصف
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Description</span>
                      </TableHead>
                      <TableHead>
                        المبلغ
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Amount</span>
                      </TableHead>
                      <TableHead>
                        الضريبة
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Tax</span>
                      </TableHead>
                      <TableHead>
                        الإجمالي
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Total</span>
                      </TableHead>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableHead className="w-1/2">
                        الوصف
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Description</span>
                      </TableHead>
                      <TableHead>
                        رقم الفاتورة
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Invoice No.</span>
                      </TableHead>
                      <TableHead>
                        المبلغ
                        <span className="ms-1 text-[10px] font-normal text-muted-foreground">Amount</span>
                      </TableHead>
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="whitespace-normal align-top text-sm">
                      <p>{serviceDescriptionAr}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {serviceDescriptionEn}
                      </p>
                    </TableCell>
                    {isInvoice ? (
                      <>
                        <TableCell className="align-top">{formatCurrency(baseAmount)}</TableCell>
                        <TableCell className="align-top">
                          {formatCurrency(vatAmount)}
                          <span className="ms-1 text-xs text-muted-foreground">({vatRate}%)</span>
                        </TableCell>
                        <TableCell className="align-top font-medium">{formatCurrency(doc.amount)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="align-top" dir="ltr">
                          {relatedInvoices[0]?.documentNumber ?? "—"}
                        </TableCell>
                        <TableCell className="align-top font-medium">{formatCurrency(doc.amount)}</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {isInvoice ? (
            <div>
              <p className="mb-1 text-sm font-semibold">إجمالي المستحق</p>
              <Row label="الإجمالي غير شامل ضريبة القيمة المضافة" value={formatCurrency(baseAmount)} />
              <Row label="مجموع الخصومات" value={formatCurrency(0)} />
              <Row label="الإجمالي الخاضع للضريبة" value={formatCurrency(baseAmount)} />
              <Row label="مجموع قيمة الضريبة" value={formatCurrency(vatAmount)} />
              <Row label="إجمالي المبلغ المستحق" value={formatCurrency(doc.amount)} bold />
              <Row label="إجمالي المبلغ المستحق كتابة" value={amountToArabicWords(doc.amount)} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Row label="إجمالي المدفوع مسبقاً" value={formatCurrency(0)} />
                <Row label="إجمالي المستلم" value={formatCurrency(doc.amount)} bold />
              </div>
              {owner.name && (
                <div className="pt-4 text-sm">
                  <p>المستلم: {owner.name}</p>
                  <p className="mt-6 text-muted-foreground">التوقيع: ..............................</p>
                </div>
              )}
            </div>
          )}

          <p className="border-t pt-4 text-center text-xs text-muted-foreground">
            مستند صادر آلياً من نظام إدارة الأملاك العقارية
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
