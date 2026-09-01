import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Check, X, FileText, Paperclip, Scale, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { deleteAgreement } from "@/lib/actions/agreements";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { netCollected, commissionBase, vatWithin } from "@/lib/commission";
import { ownerExpensesByBuilding, operatorExpensesByBuilding } from "@/lib/expenses";
import { buildSettlement } from "@/lib/settlement";
import { SettleAgreementDialog } from "@/components/agreements/settle-dialog";
import { CancelSettlementButton } from "@/components/agreements/cancel-settlement-button";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "سارية",
  EXPIRED: "منتهية",
  TERMINATED: "مفسوخة",
};

const STATUS_TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-700",
  TERMINATED: "bg-red-100 text-red-700",
};

function Authority({ granted, label, extra }: { granted: boolean; label: string; extra?: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {granted ? (
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      )}
      <span className={granted ? "" : "text-muted-foreground/60 line-through"}>
        {label}
        {granted && extra && <span className="text-muted-foreground"> — {extra}</span>}
      </span>
    </div>
  );
}

function SettlementRow({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", strong && "border-t pt-2 font-bold")}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={cn("tabular-nums", muted && "text-muted-foreground")}>{formatCurrency(value)}</span>
    </div>
  );
}

export default async function AgreementDetailPage(props: PageProps<"/agreements/[id]">) {
  const { id } = await props.params;
  await requirePagePermission("agreements.view");

  const agreement = await prisma.managementAgreement.findUnique({
    where: { id },
    include: {
      owner: true,
      settlement: true,
      buildings: { include: { building: { select: { id: true, name: true, city: true, district: true } } } },
    },
  });
  if (!agreement) notFound();

  /**
   * Commission is earned on what was collected while this agreement was in force, so the
   * figures are scoped to its period — not the building's whole history. Each building
   * carries its own percentage, so the commission is computed per line and then summed.
   */
  const period = { from: agreement.startDate, to: agreement.endDate };
  const buildingIds = agreement.buildings.map((b) => b.buildingId);
  const [expensesByBuilding, operatorExpensesMap] = await Promise.all([
    ownerExpensesByBuilding(buildingIds, period),
    operatorExpensesByBuilding(buildingIds, period),
  ]);

  const lines = await Promise.all(
    agreement.buildings.map(async (line) => {
      const collections = await prisma.payment.findMany({
        where: {
          contract: { unit: { buildingId: line.buildingId } },
          paidDate: { gte: period.from, lte: period.to },
        },
        select: { paidAmount: true, contract: { select: { vatRate: true } } },
      });
      const collected = collections.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
      const vat = vatWithin(collections);
      const expenses = expensesByBuilding.get(line.buildingId) ?? 0;
      const net = netCollected({ collected, expenses });
      // No commission on the state's tax — the same rule the statement and settlement hold to.
      const commission = commissionBase({ collected, expenses, vat }) * (line.commissionPercent / 100);
      // Expenses the operator carried reduce its own commission, never the owner's income.
      const operatorExpenses = operatorExpensesMap.get(line.buildingId) ?? 0;
      return { ...line, collected, expenses, net, commission, operatorExpenses, netCommission: commission - operatorExpenses };
    })
  );

  const totals = lines.reduce(
    (acc, l) => ({
      collected: acc.collected + l.collected,
      expenses: acc.expenses + l.expenses,
      net: acc.net + l.net,
      commission: acc.commission + l.commission,
      operatorExpenses: acc.operatorExpenses + l.operatorExpenses,
      netCommission: acc.netCommission + l.netCommission,
    }),
    { collected: 0, expenses: 0, net: 0, commission: 0, operatorExpenses: 0, netCommission: 0 }
  );

  // Once the term is over a negative commission is final, so it is flagged rather than left in the table.
  const expiredWithLoss = agreement.endDate < new Date() && totals.netCommission < 0;

  // Both the dialog and the stored statement point at the records behind the pending figure.
  const unpaidExpensesHref = `/expenses?status=unpaid&building=${agreement.buildings[0]?.buildingId ?? ""}`;

  // A live account for the settle dialog; once settled the stored statement is shown instead.
  const settlementPreview =
    agreement.status === "ACTIVE" && !agreement.settlement ? await buildSettlement(agreement.id, new Date()) : null;

  return (
    <div className="space-y-4">
      <Link href="/agreements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للاتفاقيات
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" dir="ltr">
              {agreement.agreementNumber}
            </h1>
            <Badge variant="secondary" className={cn("border-0 font-medium", STATUS_TONES[agreement.status])}>
              {STATUS_LABELS[agreement.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/owners/${agreement.ownerId}`} className="hover:underline">
              {agreement.owner.name}
            </Link>
            {" · "}
            {formatDate(agreement.startDate)} — {formatDate(agreement.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {settlementPreview && (
            <SettleAgreementDialog
              agreementId={agreement.id}
              preview={settlementPreview}
              unpaidExpensesHref={unpaidExpensesHref}
            />
          )}
          {agreement.fileUrl && (
            <Button variant="outline" asChild>
              <a href={`/api/files/${agreement.fileUrl}`} target="_blank" rel="noreferrer">
                <Paperclip className="size-4" />
                النسخة الموقّعة
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/agreements/${agreement.id}/print`}>
              <FileText className="size-4" />
              صيغة الاتفاقية
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/agreements/${agreement.id}/edit`}>
              <Pencil className="size-4" />
              تعديل
            </Link>
          </Button>
          <DeleteButton
            action={deleteAgreement.bind(null, agreement.id)}
            permission="agreements.delete" title="حذف الاتفاقية"
            description="سيتم حذف الاتفاقية وبنودها نهائياً. لا يمكن التراجع عن هذا الإجراء."
          />
        </div>
      </div>

      {expiredWithLoss && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">تنبيه: انتهت مدة الاتفاقية وصافي العمولة بالسالب</p>
            <p className="mt-1 text-xs leading-6">
              بلغ صافي العمولة {formatCurrency(totals.netCommission)} عن كامل المدة — أي أن المصروفات تجاوزت ما
              استُحق. راجع المبالغ المحصّلة والمصروفات المسجّلة على المبنى قبل التصفية.
            </p>
          </div>
        </div>
      )}

      {agreement.settlement && (
        <Card className="gap-0 border-amber-200 py-0">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b bg-amber-50/60 py-3.5">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <Scale className="size-4" />
                كشف التصفية النهائي
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                محفوظ بتاريخ {formatDate(agreement.settlement.settledAt)} عن الفترة{" "}
                {formatDate(agreement.settlement.periodFrom)} — {formatDate(agreement.settlement.periodTo)}؛
                لا يتأثر بأي حركة تُسجَّل بعده
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/agreements/${agreement.id}/settlement`}>
                  <FileText className="size-4" />
                  كشف للمالك
                </Link>
              </Button>
              <CancelSettlementButton agreementId={agreement.id} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p className="font-semibold">حساب المالك</p>
              <SettlementRow label="المحصّل" value={agreement.settlement.collected} />
              <SettlementRow label="− مصروفات على المالك" value={agreement.settlement.ownerExpenses} muted />
              <SettlementRow label="صافي المحصّل" value={agreement.settlement.netCollected} strong />
              <SettlementRow
                label={`− عمولة الإدارة ${agreement.settlement.commissionPercent}%`}
                value={agreement.settlement.commission}
                muted
              />
              <SettlementRow label="المستحق توريده للمالك" value={agreement.settlement.payableToOwner} strong />
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">حصة مدير الأملاك</p>
              <SettlementRow label="عمولة الإدارة" value={agreement.settlement.commission} />
              <SettlementRow label="− مصروفات تحمّلها المشغل" value={agreement.settlement.operatorExpenses} muted />
              <SettlementRow label="صافي العمولة" value={agreement.settlement.netCommission} strong />
              {(agreement.settlement.pendingArrears > 0 || agreement.settlement.pendingExpenses > 0) && (
                <div className="mt-3 space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">بنود معلّقة وقت التصفية (خارج الحساب)</p>
                  {agreement.settlement.pendingArrears > 0 && (
                    <p>متأخرات لم تُحصّل: {formatCurrency(agreement.settlement.pendingArrears)}</p>
                  )}
                  {agreement.settlement.pendingExpenses > 0 && (
                    <p>
                      مصروفات لم تُدفع:{" "}
                      <Link href={unpaidExpensesHref} className="underline underline-offset-4 hover:no-underline">
                        {formatCurrency(agreement.settlement.pendingExpenses)}
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
            {agreement.settlement.notes && (
              <div className="sm:col-span-2 border-t pt-3 text-sm">
                <p className="text-xs text-muted-foreground">ملاحظات التصفية</p>
                <p className="mt-1 whitespace-pre-wrap">{agreement.settlement.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">المبنى والعمولة</CardTitle>
          <p className="text-xs text-muted-foreground">
            المبالغ المحصّلة خلال فترة الاتفاقية ({formatDate(agreement.startDate)} — {formatDate(agreement.endDate)})،
            والعمولة محسوبة لكل مبنى بنسبته من صافي المحصّل بعد المصروفات
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد مبانٍ مشمولة بهذه الاتفاقية</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المبنى</TableHead>
                    <TableHead className="text-left">المحصّل</TableHead>
                    <TableHead className="text-left">المصروفات</TableHead>
                    <TableHead className="text-left">صافي المحصّل</TableHead>
                    <TableHead className="text-left">النسبة</TableHead>
                    <TableHead className="text-left">العمولة</TableHead>
                    <TableHead className="text-left">مصروفات المشغل</TableHead>
                    <TableHead className="text-left">صافي العمولة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        <Link href={`/buildings/${line.building.id}`} className="hover:underline">
                          {line.building.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {line.building.city ?? "—"} {line.building.district ? `- ${line.building.district}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-left tabular-nums">{formatCurrency(line.collected)}</TableCell>
                      <TableCell className="text-left tabular-nums text-muted-foreground">
                        {formatCurrency(line.expenses)}
                      </TableCell>
                      <TableCell className="text-left tabular-nums">{formatCurrency(line.net)}</TableCell>
                      <TableCell className="text-left font-medium tabular-nums">{line.commissionPercent}%</TableCell>
                      <TableCell className="text-left tabular-nums">{formatCurrency(line.commission)}</TableCell>
                      <TableCell className="text-left tabular-nums text-muted-foreground">
                        {formatCurrency(line.operatorExpenses)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-left font-bold tabular-nums",
                          line.netCommission < 0 ? "text-red-600" : "text-primary"
                        )}
                      >
                        {formatCurrency(line.netCommission)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/60 font-bold">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(totals.collected)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(totals.expenses)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(totals.net)}</TableCell>
                    <TableCell className="text-left text-muted-foreground">—</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(totals.commission)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(totals.operatorExpenses)}</TableCell>
                    <TableCell className={cn("text-left tabular-nums", totals.netCommission < 0 ? "text-red-600" : "text-primary")}>
                      {formatCurrency(totals.netCommission)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">الصلاحيات الممنوحة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-4">
          <Authority granted={agreement.canSignContracts} label="توقيع عقود الإيجار نيابة عن المالك" />
          <Authority granted={agreement.canCollectRent} label="تحصيل الإيجارات نيابة عن المالك" />
          <Authority
            granted={agreement.canMaintain}
            label="تنفيذ أعمال الصيانة"
            extra={agreement.maintenanceLimit ? `حتى ${formatCurrency(agreement.maintenanceLimit)}` : undefined}
          />
          <Authority granted={agreement.canLitigate} label="رفع الدعاوى والإخلاء عبر ناجز" />
          <Authority granted={agreement.canNegotiateRenewal} label="التفاوض على قيمة الإيجار والتجديد" />
          {agreement.otherAuthorities && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">صلاحيات أخرى</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{agreement.otherAuthorities}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(agreement.terms || agreement.duties || agreement.notes) && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">الشروط والواجبات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4 text-sm">
            {agreement.terms && (
              <div>
                <p className="text-xs text-muted-foreground">شروط الاتفاقية</p>
                <p className="mt-1 whitespace-pre-wrap">{agreement.terms}</p>
              </div>
            )}
            {agreement.duties && (
              <div>
                <p className="text-xs text-muted-foreground">واجبات مدير الأملاك</p>
                <p className="mt-1 whitespace-pre-wrap">{agreement.duties}</p>
              </div>
            )}
            {agreement.notes && (
              <div>
                <p className="text-xs text-muted-foreground">ملاحظات</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{agreement.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
