import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/contracts/print-button";
import { DeleteButton } from "@/components/delete-button";
import { RemittanceDialog } from "@/components/owners/remittance-dialog";
import { deleteRemittance } from "@/lib/actions/remittances";
import { ownerAccount } from "@/lib/owner-account";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Defaults to the current month — the period an owner statement is usually run for. */
function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function parseDate(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value ? value : fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export default async function OwnerStatementPage(props: PageProps<"/owners/[id]/statement">) {
  const { id } = await props.params;
  await requirePagePermission("statements.view");
  const params = await props.searchParams;

  const fallback = defaultPeriod();
  const from = parseDate(params.from, fallback.from);
  // The whole closing day belongs to the period, so it runs to the last moment of it.
  const toRaw = parseDate(params.to, fallback.to);
  const to = new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999);

  const [owner, org] = await Promise.all([
    prisma.owner.findUnique({ where: { id } }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!owner) notFound();

  const { lines, totals } = await ownerAccount(id, { from, to });

  const remittances = await prisma.ownerRemittance.findMany({
    where: { ownerId: id, remittedAt: { gte: from, lte: to } },
    include: {
      building: { select: { name: true } },
      documents: { select: { id: true, documentNumber: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { remittedAt: "desc" },
  });

  const fromValue = from.toISOString().slice(0, 10);
  const toValue = toRaw.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/owners/${owner.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
          العودة للمالك
        </Link>
        <PrintButton />
      </div>

      <form action={`/owners/${owner.id}/statement`} className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="space-y-1">
          <label htmlFor="from" className="block text-xs text-muted-foreground">
            من تاريخ
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={fromValue}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="block text-xs text-muted-foreground">
            إلى تاريخ
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={toValue}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
        <button type="submit" className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">
          عرض الكشف
        </button>
      </form>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6 sm:p-8 print:p-0">
          <header className="space-y-2 border-b pb-4 text-center">
            {org?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
            )}
            <h1 className="text-lg font-bold">كشف حساب مالك</h1>
            <p className="text-sm text-muted-foreground">
              {owner.name} · من {formatDate(from)} إلى {formatDate(toRaw)}
            </p>
          </header>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العقار</TableHead>
                  <TableHead className="text-left">المحصّل</TableHead>
                  <TableHead className="text-left">المصروفات</TableHead>
                  <TableHead className="text-left">صافي المحصّل</TableHead>
                  <TableHead className="text-left">العمولة</TableHead>
                  <TableHead className="text-left">مستحق المالك</TableHead>
                  <TableHead className="text-left">قبضه المالك</TableHead>
                  <TableHead className="text-left">المورَّد</TableHead>
                  <TableHead className="text-left">الرصيد</TableHead>
                  <TableHead className="print:hidden">خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.buildingId}>
                    <TableCell className="font-medium">
                      <Link href={`/buildings/${l.buildingId}`} className="hover:underline">
                        {l.buildingName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {l.commissionPercent > 0 ? `عمولة ${l.commissionPercent}%` : "بلا اتفاقية سارية"}
                      </span>
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(l.collected)}</TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(l.ownerExpenses)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(l.netCollected)}</TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(l.commission)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(l.payableToOwner)}</TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(l.collectedByOwner)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(l.remitted)}
                    </TableCell>
                    <TableCell
                      className={cn("text-left font-bold tabular-nums", l.balance < 0 ? "text-red-600" : "text-primary")}
                    >
                      {formatCurrency(l.balance)}
                    </TableCell>
                    <TableCell className="print:hidden">
                      <RemittanceDialog
                        buildingId={l.buildingId}
                        buildingName={l.buildingName}
                        suggestedAmount={l.balance}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/60 font-bold">
                  <TableCell>الإجمالي</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.collected)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.ownerExpenses)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.netCollected)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.commission)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.payableToOwner)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.collectedByOwner)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.remitted)}</TableCell>
                  <TableCell
                    className={cn("text-left tabular-nums", totals.balance < 0 ? "text-red-600" : "text-primary")}
                  >
                    {formatCurrency(totals.balance)}
                  </TableCell>
                  <TableCell className="print:hidden" />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs leading-6 text-muted-foreground">
            «قبضه المالك» هو ما استلمه المالك مباشرة من المستأجرين خلال الفترة، ويُخصم من مستحقه لأنه وصله فعلاً،
            وتبقى عمولة الإدارة مستحقة عليه. و«الرصيد» بالسالب يعني أن المالك مدين لمدير الأملاك.
          </p>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 print:hidden">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">سندات التوريد خلال الفترة ({remittances.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {remittances.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لم تُسجَّل توريدات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم السند</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العقار</TableHead>
                    <TableHead>الطريقة</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                    <TableHead>سجّله</TableHead>
                    <TableHead>خيارات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remittances.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell dir="ltr" className="font-medium">
                        {r.documents[0] ? (
                          <Link href={`/documents/${r.documents[0].id}`} className="hover:underline">
                            {r.documents[0].documentNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(r.remittedAt)}</TableCell>
                      <TableCell>{r.building.name}</TableCell>
                      <TableCell>{r.method ?? "—"}</TableCell>
                      <TableCell dir="ltr">{r.reference ?? "—"}</TableCell>
                      <TableCell className="text-left tabular-nums">{formatCurrency(r.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.createdBy?.name ?? "—"}</TableCell>
                      <TableCell>
                        <DeleteButton
                          action={deleteRemittance.bind(null, r.id)}
                          permission="remittances.delete" title="حذف سند التوريد"
                          description="سيُحذف السند والتحويل المسجّل معه، ويعود المبلغ إلى رصيد المالك."
                        />
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
