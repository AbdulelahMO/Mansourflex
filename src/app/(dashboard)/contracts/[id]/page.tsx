import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RenewContractDialog } from "@/components/contracts/renew-contract-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { ContractActionsMenu } from "@/components/contracts/contract-actions-menu";
import { MarkPaidDialog } from "@/components/payments/mark-paid-dialog";
import { EditCollectionDialog } from "@/components/payments/edit-collection-dialog";
import { IssueDocumentButtons } from "@/components/contracts/document-actions";
import { DeleteButton } from "@/components/delete-button";
import { cancelFinancialDocument } from "@/lib/actions/documents";
import { reverseCollection } from "@/lib/actions/payments";
import { contractArrears } from "@/lib/actions/contracts";
import { VacateUnitButton } from "@/components/contracts/vacate-unit-button";
import { CancelDocumentButton } from "@/components/documents/cancel-document-button";

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  TOTAL: "إجمالي",
  ANNUAL: "سنوي",
  INCREASING: "متزايد",
};

/** Who took the money in: the operator on the owner's behalf, or the owner directly. */
const RECIPIENT_LABELS: Record<string, string> = {
  OPERATOR: "المشغل",
  OWNER: "المالك",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "فاتورة",
  RECEIPT: "سند قبض",
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "شهري",
  QUARTERLY: "ربع سنوي",
  SEMI_ANNUAL: "نصف سنوي",
  ANNUAL: "سنوي",
  ONE_TIME: "دفعة واحدة",
};

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function ContractDetailPage(props: PageProps<"/contracts/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("contracts.edit");

  const contract = await prisma.contract.findFirst({
    where: { id, unit: { building: scope } },
    include: {
      unit: { include: { building: true } },
      tenant: true,
      payments: { orderBy: { dueDate: "asc" }, include: { collectedBy: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { name: true } },
      renewedFrom: { select: { id: true, contractNumber: true } },
      renewedTo: { select: { id: true, contractNumber: true } },
    },
  });
  if (!contract) notFound();

  // What still holds the unit after the lease is over.
  const arrears = contract.status === "ACTIVE" ? 0 : await contractArrears(contract.id);

  // A payment may carry many receipts but only one invoice.
  const invoiceByPaymentId = new Map(
    contract.documents
      .filter((d) => d.type === "INVOICE" && d.paymentId)
      .map((d) => [d.paymentId as string, d.documentNumber])
  );

  // Receipts are issued against an invoice, so that invoice stays locked until they are removed.
  const receiptsByPaymentId = new Map<string, string[]>();
  const recipientByPaymentId = new Map(contract.payments.map((p) => [p.id, p.recipient]));
  const collectorByPaymentId = new Map(contract.payments.map((p) => [p.id, p.collectedBy?.name ?? null]));
  const receiptedByPaymentId = new Map<string, number>();
  for (const d of contract.documents) {
    if (d.type !== "RECEIPT" || !d.paymentId) continue;
    const list = receiptsByPaymentId.get(d.paymentId) ?? [];
    list.push(d.documentNumber);
    receiptsByPaymentId.set(d.paymentId, list);
    receiptedByPaymentId.set(d.paymentId, (receiptedByPaymentId.get(d.paymentId) ?? 0) + d.amount);
  }

  function deleteBlockedReason(doc: { type: string; paymentId: string | null; documentNumber: string }) {
    if (doc.type !== "INVOICE" || !doc.paymentId) return null;
    const receipts = receiptsByPaymentId.get(doc.paymentId);
    if (!receipts?.length) return null;
    return `صدر على الفاتورة ${doc.documentNumber} سند قبض (${receipts.join("، ")}). احذف السند أولاً ثم احذف الفاتورة.`;
  }

  return (
    <div className="space-y-4">
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للعقود
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" dir="ltr">
            {contract.contractNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {contract.unit.building.name} - وحدة {contract.unit.unitNumber} · {contract.tenant.name}
            {contract.createdBy && ` · أنشأه ${contract.createdBy.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={contract.status} />
          {canManage && contract.status !== "TERMINATED" && (
            <RenewContractDialog
              contract={{
                id: contract.id,
                contractNumber: contract.contractNumber,
                endDate: contract.endDate,
                rentAmount: contract.rentAmount,
                renewedToNumber: contract.renewedTo?.contractNumber ?? null,
              }}
            />
          )}
          {canManage && <ContractActionsMenu id={contract.id} status={contract.status} />}
        </div>
      </div>

      {/* The lease is over but the unit is still held: someone has to say what happens to it. */}
      {contract.status !== "ACTIVE" && contract.unit.status !== "VACANT" && !contract.renewedTo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            <p className="font-medium">انتهى العقد والوحدة ما زالت محجوزة</p>
            <p className="mt-0.5 text-xs">
              {arrears > 0
                ? `على العقد مستحقات ${formatCurrency(arrears)} — تبقى الوحدة مؤجرة حتى تُسوّى، فلا تُعرض لمستأجر جديد ودين سابقها قائم.`
                : "المستحقات مسددة — جدّد العقد إن بقي المستأجر، أو أخلِ الوحدة إن خرج."}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <RenewContractDialog
                contract={{
                  id: contract.id,
                  contractNumber: contract.contractNumber,
                  endDate: contract.endDate,
                  rentAmount: contract.rentAmount,
                  // The banner only shows while nothing has renewed this contract.
                  renewedToNumber: null,
                }}
              />
              <VacateUnitButton contractId={contract.id} arrears={arrears} />
            </div>
          )}
        </div>
      )}

      {(contract.renewedFrom || contract.renewedTo) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          {contract.renewedFrom && (
            <span>
              <span className="text-muted-foreground">مُجدَّد من: </span>
              <Link href={`/contracts/${contract.renewedFrom.id}`} className="font-medium hover:underline" dir="ltr">
                {contract.renewedFrom.contractNumber}
              </Link>
            </span>
          )}
          {contract.renewedTo && (
            <span>
              <span className="text-muted-foreground">جُدِّد إلى: </span>
              <Link href={`/contracts/${contract.renewedTo.id}`} className="font-medium hover:underline" dir="ltr">
                {contract.renewedTo.contractNumber}
              </Link>
            </span>
          )}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          <InfoItem label="المبنى" value={contract.unit.building.name} />
          <InfoItem label="الوحدة" value={contract.unit.unitNumber} />
          <InfoItem label="المستأجر" value={contract.tenant.name} />
          <InfoItem label="جوال المستأجر" value={contract.tenant.phone} />
          <InfoItem label="رقم عقد إيجار" value={contract.ejarContractNumber} />
          <InfoItem label="تاريخ البداية" value={formatDate(contract.startDate)} />
          <InfoItem label="تاريخ النهاية" value={formatDate(contract.endDate)} />
          <InfoItem
            label="قيمة الإيجار"
            value={`${formatCurrency(contract.rentAmount)} (${AMOUNT_TYPE_LABELS[contract.amountType]})`}
          />
          {contract.increasePercent && <InfoItem label="نسبة الزيادة السنوية" value={`${contract.increasePercent}%`} />}
          <InfoItem label="ضريبة القيمة المضافة" value={contract.vatRate > 0 ? `${contract.vatRate}%` : "بدون ضريبة"} />
          <InfoItem label="طريقة السداد" value={FREQUENCY_LABELS[contract.paymentFrequency]} />
          <InfoItem label="التأمين" value={contract.depositAmount ? formatCurrency(contract.depositAmount) : null} />
        </CardContent>
        {contract.notes && (
          <CardContent className="border-t pt-4 text-sm text-muted-foreground">{contract.notes}</CardContent>
        )}
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">جدول الدفعات ({contract.payments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الدفع</TableHead>
                  {canManage && <TableHead className="w-52">خيارات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.payments.map((p, i) => {
                  const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0));
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{formatDate(p.dueDate)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>{p.paidAmount ? formatCurrency(p.paidAmount) : "—"}</TableCell>
                      <TableCell className={remaining > 0 ? "font-medium text-red-600" : "text-muted-foreground"}>
                        {formatCurrency(remaining)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={p.status} />
                          {p.najizReferredAt && (
                            <span className="text-[10px] font-medium text-emerald-700">
                              محال لناجز · {formatDate(p.najizReferredAt)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{p.paidDate ? formatDate(p.paidDate) : "—"}</TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {p.status !== "PAID" && <MarkPaidDialog paymentId={p.id} amount={remaining} />}
                            {(p.paidAmount ?? 0) > 0 && p.paidDate && (
                              <EditCollectionDialog
                                paymentId={p.id}
                                paidAmount={p.paidAmount ?? 0}
                                paidDate={toInputDate(p.paidDate)}
                                method={p.method}
                                recipient={p.recipient}
                                reference={p.reference}
                                notes={p.notes}
                              />
                            )}
                            <IssueDocumentButtons
                              paymentId={p.id}
                              settled={
                                p.status === "PAID" &&
                                (receiptsByPaymentId.get(p.id)?.length ?? 0) > 0 &&
                                (p.paidAmount ?? 0) - (receiptedByPaymentId.get(p.id) ?? 0) <= 0
                              }
                              invoiceNumber={invoiceByPaymentId.get(p.id) ?? null}
                              najizReferredAt={p.najizReferredAt}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">المستندات المالية ({contract.documents.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contract.documents.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              لا توجد مستندات بعد — أصدر فاتورة أو سند قبض من جدول الدفعات أعلاه
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم المستند</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>المستلم</TableHead>
                    <TableHead>مُدخِل الدفعة</TableHead>
                    <TableHead>الضريبة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-32">خيارات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contract.documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium" dir="ltr">
                        {d.documentNumber}
                      </TableCell>
                      <TableCell>{DOCUMENT_TYPE_LABELS[d.type]}</TableCell>
                      <TableCell>{formatDate(d.issueDate)}</TableCell>
                      <TableCell>{formatCurrency(d.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(() => {
                          const recipient = d.paymentId ? recipientByPaymentId.get(d.paymentId) : null;
                          return recipient ? RECIPIENT_LABELS[recipient] : "—";
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(d.paymentId ? collectorByPaymentId.get(d.paymentId) : null) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {d.hasTax ? (
                          <span dir="ltr" className="text-xs text-muted-foreground">
                            {/* A contract may carry VAT before the owner's registration number is on file. */}
                            {d.taxNumber ? `ضريبية · ${d.taxNumber}` : "ضريبية · بلا رقم ضريبي للمالك"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">بدون ضريبة</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/documents/${d.id}`}>عرض</Link>
                          </Button>
                          {canManage &&
                            (d.type === "RECEIPT" ? (
                              // A receipt is not voided on its own: undoing the collection takes
                              // the money back off the instalment and the receipt goes with it.
                              <CancelDocumentButton
                                documentNumber={d.documentNumber}
                                cancelled={d.status === "CANCELLED"}
                                action={reverseCollection.bind(null, d.id)}
                                permission="payments.reverse"
                                title="التراجع عن التحصيل"
                                heading="التراجع عن تحصيل السند"
                                confirmLabel="تراجع عن التحصيل"
                                approvalNote="التراجع عن التحصيل يحتاج موافقة مدير النظام. اكتب السبب وسيُنفَّذ فور موافقته."
                                description={`يُخصم مبلغ السند من محصّل القسط ويُلغى السند ${d.documentNumber} معه، فيعود القسط إلى ما كان عليه قبل هذا التحصيل. يبقى السند برقمه مختوماً بـ«ملغى» مع السبب.`}
                              />
                            ) : (
                              <CancelDocumentButton
                                documentNumber={d.documentNumber}
                                cancelled={d.status === "CANCELLED"}
                                action={cancelFinancialDocument.bind(null, d.id)}
                              />
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
