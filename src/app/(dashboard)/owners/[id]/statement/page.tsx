import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/contracts/print-button";
import { DeleteButton } from "@/components/delete-button";
import { RemittanceDialog } from "@/components/owners/remittance-dialog";
import { CommissionDialog } from "@/components/owners/commission-dialog";
import { buildingCommissionAccount } from "@/lib/commission-standing";
import { cancelRemittance } from "@/lib/actions/remittances";
import { cancelCommissionCollection } from "@/lib/actions/commission";
import { CancelDocumentButton } from "@/components/documents/cancel-document-button";
import { ownerAccount } from "@/lib/owner-account";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Fact } from "@/components/statements/fact";

/** The stored value is a key, not a word anyone reads: «INDIVIDUAL» is not a صفة. */
const OWNER_TYPES: Record<string, string> = {
  INDIVIDUAL: "فرد",
  COMPANY: "شركة / مؤسسة",
};

/** Formats a calendar date without letting the timezone shift it a day. */
function toInput(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Defaults to the current year: a month-to-date statement is often empty — rent is collected
 * quarterly or annually as often as monthly — and an empty statement reads like a fault.
 */
function defaultPeriod() {
  const now = new Date();
  return {
    from: toInput(now.getFullYear(), 0, 1),
    to: toInput(now.getFullYear(), 11, 31),
  };
}

function parseDate(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value ? value : fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export default async function OwnerStatementPage(props: PageProps<"/owners/[id]/statement">) {
  const { id } = await props.params;
  const viewer = await requireUser();
  // An owner reaches their own statement from the portal; staff need the permission.
  if (viewer.role === "OWNER") {
    if (viewer.ownerId !== id) notFound();
  } else {
    await requirePagePermission("statements.view");
  }
  const params = await props.searchParams;

  const fallback = defaultPeriod();
  const from = parseDate(params.from, fallback.from);
  // The whole closing day belongs to the period, so it runs to the last moment of it.
  const toRaw = parseDate(params.to, fallback.to);
  const to = new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999);

  const [owner, org, buildings] = await Promise.all([
    prisma.owner.findUnique({ where: { id } }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
    prisma.building.findMany({
      where: { ownerId: id },
      select: { id: true, name: true, city: true, district: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!owner) notFound();

  // A property that is not this owner's is not a filter but a mistake, and is ignored rather than
  // returning an empty statement that reads as «this property produced nothing».
  const requestedBuilding = typeof params.building === "string" ? params.building : "";
  const building = buildings.find((b) => b.id === requestedBuilding) ?? null;

  const { lines, totals } = await ownerAccount(id, { from, to }, building?.id);

  // Sitting with the owner is one errand: hand over what is his, take what is owed. So the fee's
  // standing travels with each property's line, and both vouchers are issued from the same row.
  const standings = new Map(
    await Promise.all(
      lines.map(async (l) => [l.buildingId, await buildingCommissionAccount(l.buildingId)] as const)
    )
  );

  // Fees received back from the owner belong on their statement beside the transfers out: both
  // are money that moved between the two parties, and a statement that shows one and not the
  // other leaves the owner wondering what the missing amount was.
  const commissionReceipts = await prisma.commissionCollection.findMany({
    where: { ownerId: id, ...(building ? { buildingId: building.id } : {}), collectedAt: { gte: from, lte: to } },
    include: {
      building: { select: { name: true } },
      documents: { select: { id: true, documentNumber: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { collectedAt: "desc" },
  });

  const remittances = await prisma.ownerRemittance.findMany({
    // The transfers must narrow with the account they settle: transfers for other properties
    // listed under one property's statement are worse than no filter at all.
    where: { ownerId: id, ...(building ? { buildingId: building.id } : {}), remittedAt: { gte: from, lte: to } },
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
    <div className="print-wide space-y-4">
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
        {buildings.length > 1 && (
          <div className="space-y-1">
            <label htmlFor="building" className="block text-xs text-muted-foreground">
              العقار
            </label>
            <select
              id="building"
              name="building"
              defaultValue={building?.id ?? ""}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">كل العقارات</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <header className="space-y-4 border-b pb-4">
            <div className="space-y-1 text-center">
              {org?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
              )}
              <h1 className="text-lg font-bold">كشف حساب المالك</h1>
              <p className="text-xs text-muted-foreground">
                من {formatDate(from)} إلى {formatDate(toRaw)}
              </p>
            </div>

            {/* Whose account, and by which numbers he is known — the part a reader checks before
                the figures, and what makes the sheet identify itself months later in a file. */}
            <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
              <Fact label="المالك" value={owner.name} />
              <Fact label="الصفة" value={OWNER_TYPES[owner.ownerType ?? ""]} />
              <Fact label="رقم الهوية" value={owner.nationalId} />
              <Fact label="الرقم الموحّد" value={owner.unifiedNumber} />
              <Fact label="الرقم الضريبي" value={owner.taxNumber} />
              <Fact label="الجوال" value={owner.phone} />
              <Fact
                label="ممثل المالك"
                value={owner.representativeName}
                note={owner.representativePhone}
              />
              <Fact
                label="العقار"
                value={building ? building.name : "كل العقارات"}
                // Named properties repeat across cities — «برج الواحة» is not one building, and a
                // statement filed away needs to say which one it was about.
                note={building ? [building.city, building.district].filter(Boolean).join(" — ") : null}
              />
            </dl>
          </header>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العقار</TableHead>
                  <TableHead className="text-left">الإشغال</TableHead>
                  <TableHead className="text-left">إيراد الفترة</TableHead>
                  <TableHead className="text-left">المحصّل</TableHead>
                  <TableHead className="text-left">المتأخر</TableHead>
                  <TableHead className="text-left">المصروفات</TableHead>
                  <TableHead className="text-left print:hidden">أساس العمولة</TableHead>
                  <TableHead className="text-left">العمولة</TableHead>
                  <TableHead className="text-left">نصيب المالك</TableHead>
                  <TableHead className="text-left">قبضه المالك</TableHead>
                  <TableHead className="text-left">المحوَّل له</TableHead>
                  <TableHead className="text-left">رصيد المالك</TableHead>
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
                    <TableCell className="text-left">
                      <span className="font-medium tabular-nums">
                        {l.units ? Math.round((l.occupiedUnits / l.units) * 100) : 0}%
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {l.occupiedUnits} من {l.units}
                      </span>
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(l.billed)}</TableCell>
                    <TableCell className="text-left tabular-nums">
                      {formatCurrency(l.collected)}
                      {/* The tax inside the collection, named where the money is, so nobody has to
                          work out why the commission is smaller than the percentage suggests. */}
                      {l.collectedVat > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          منها ضريبة {formatCurrency(l.collectedVat)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn("text-left tabular-nums", l.outstanding > 0 ? "text-red-600" : "text-muted-foreground")}
                    >
                      {formatCurrency(l.outstanding)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(l.ownerExpenses)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums print:hidden">{formatCurrency(l.commissionBase)}</TableCell>
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
                      <div className="flex flex-wrap items-center gap-1">
                        <RemittanceDialog
                          buildingId={l.buildingId}
                          buildingName={l.buildingName}
                          suggestedAmount={l.balance}
                          unsettledFee={standings.get(l.buildingId)?.unsettled ?? 0}
                        />
                        <CommissionDialog
                          buildingId={l.buildingId}
                          buildingName={l.buildingName}
                          unsettledAmount={standings.get(l.buildingId)?.unsettled ?? 0}
                          triggerLabel="قبض أتعاب"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {/* With one property on the sheet the totals row repeats it word for word. */}
                {lines.length > 1 && (
                <TableRow className="bg-muted/60 font-bold">
                  <TableCell>الإجمالي</TableCell>
                  <TableCell className="text-left">
                    <span className="tabular-nums">
                      {totals.units ? Math.round((totals.occupiedUnits / totals.units) * 100) : 0}%
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                      {totals.occupiedUnits} من {totals.units}
                    </span>
                  </TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.billed)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.collected)}</TableCell>
                  <TableCell
                    className={cn("text-left tabular-nums", totals.outstanding > 0 && "text-red-600")}
                  >
                    {formatCurrency(totals.outstanding)}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrency(totals.ownerExpenses)}</TableCell>
                  <TableCell className="text-left tabular-nums print:hidden">{formatCurrency(totals.commissionBase)}</TableCell>
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
                )}
              </TableBody>
            </Table>
          </div>

          {totals.collected === 0 && totals.ownerExpenses === 0 && totals.remitted === 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
              لا توجد حركة مالية في هذه الفترة — لا تحصيل ولا مصروفات ولا توريد. وسّع الفترة أعلاه إن كان
              التحصيل ربع سنوي أو سنوياً.
            </p>
          )}

          <p className="text-xs leading-6 text-muted-foreground">
            {/* Only what the column headings cannot say for themselves. */}
            «إيراد الفترة» ما تستحقه العقود القائمة لا طاقة العقار كاملة · العمولة على الإيجار بعد المصروفات
            دون الضريبة، والضريبة تبقى في نصيب المالك ليوردها · ما قبضه المالك مباشرة يُخصم من نصيبه
            وتبقى العمولة عليه · الرصيد بالسالب يعني أن المالك مدين للمشغل.
          </p>
        </CardContent>
      </Card>

      {commissionReceipts.length > 0 && (
        <Card className="gap-0 py-0 print:hidden">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">
              أتعاب إدارة قُبضت من المالك ({commissionReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                  {commissionReceipts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell dir="ltr" className="font-medium">
                        {c.cancelledAt && (
                          <span className="me-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            ملغى
                          </span>
                        )}
                        {c.documents[0] ? (
                          <Link href={`/documents/${c.documents[0].id}`} className="hover:underline">
                            {c.documents[0].documentNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(c.collectedAt)}</TableCell>
                      <TableCell>{c.building.name}</TableCell>
                      <TableCell>{c.method ?? "—"}</TableCell>
                      <TableCell dir="ltr">{c.reference ?? "—"}</TableCell>
                      <TableCell
                        className={cn("text-left tabular-nums", c.cancelledAt && "text-muted-foreground line-through")}
                      >
                        {formatCurrency(c.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.createdBy?.name ?? "—"}</TableCell>
                      <TableCell>
                        <CancelDocumentButton
                          documentNumber={c.documents[0]?.documentNumber ?? ""}
                          cancelled={!!c.cancelledAt}
                          action={cancelCommissionCollection.bind(null, c.id)}
                          description="يُلغى السند وتعود الأتعاب ديناً على المالك، ويبقى السند برقمه مختوماً بـ«ملغى»."
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                        {r.cancelledAt && (
                          <span className="me-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            ملغى
                          </span>
                        )}
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
                      <TableCell
                        className={cn("text-left tabular-nums", r.cancelledAt && "text-muted-foreground line-through")}
                      >
                        {formatCurrency(r.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.createdBy?.name ?? "—"}</TableCell>
                      <TableCell>
                        <CancelDocumentButton
                          documentNumber={r.documents[0]?.documentNumber ?? ""}
                          cancelled={!!r.cancelledAt}
                          action={cancelRemittance.bind(null, r.id)}
                          description="يُلغى سند التوريد ويعود مبلغه إلى رصيد المالك، ويبقى السند برقمه مختوماً بـ«ملغى»."
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
