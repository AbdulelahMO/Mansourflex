import Link from "next/link";
import { ChevronRight, ShieldAlert, PartyPopper } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/contracts/print-button";
import { AGING_BUCKETS, summarizeAging, type AgingItem } from "@/lib/aging";
import { formatCurrencyPrecise, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The older the money, the hotter the column — the shape of the debt read before the figures are. */
const BUCKET_TONE: Record<string, string> = {
  upTo30: "text-muted-foreground",
  upTo60: "text-amber-700",
  upTo90: "text-orange-700",
  over90: "text-red-600 font-medium",
};

/** Arabic counts its nouns: one, two, a few, then many — «2 قسطاً متأخراً» is not a sentence. */
function lateInstalments(count: number) {
  if (count === 1) return "قسط واحد متأخر";
  if (count === 2) return "قسطان متأخران";
  if (count <= 10) return `${count} أقساط متأخرة`;
  return `${count} قسطاً متأخراً`;
}

/**
 * Arrears by age.
 *
 * The collection screen answers «how much», and every other screen stops there. This one answers
 * «since when», which is the question that orders the work: the oldest debt is the one about to
 * be lost, and past ninety days it is no longer a phone call but a deposit to apply, a referral
 * to Najiz, or a lease not to renew. One row per tenant, since the debt follows the tenant.
 */
export default async function AgingPage(props: PageProps<"/payments/aging">) {
  const user = await requireUser();
  await requirePagePermission("payments.view");
  const canStatement = await can("statements.tenant");
  const scope = buildingScope(user);
  const params = await props.searchParams;

  const buildingId = typeof params.building === "string" ? params.building : "";

  const asOf = new Date();
  // The whole of today counts as not yet late: an instalment due this morning is not a debt tonight.
  const dueThrough = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 23, 59, 59, 999);

  const [org, buildings, overdue] = await Promise.all([
    prisma.organizationSettings.findUnique({ where: { id: "default" }, select: { name: true, logoUrl: true } }),
    prisma.building.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.payment.findMany({
      where: {
        status: { not: "PAID" },
        dueDate: { lte: dueThrough },
        contract: { unit: { building: { ...scope, ...(buildingId ? { id: buildingId } : {}) } } },
      },
      select: {
        dueDate: true,
        amount: true,
        paidAmount: true,
        najizReferredAt: true,
        contract: {
          select: {
            tenantId: true,
            tenant: { select: { name: true, phone: true } },
            unit: { select: { unitNumber: true, building: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const items: AgingItem[] = overdue.map((p) => ({
    tenantId: p.contract.tenantId,
    tenantName: p.contract.tenant.name,
    buildingName: p.contract.unit.building.name,
    unitNumber: p.contract.unit.unitNumber,
    dueDate: p.dueDate,
    remaining: Math.max(0, Math.round((p.amount - (p.paidAmount ?? 0)) * 100) / 100),
    referred: !!p.najizReferredAt,
  }));

  const { rows, totals } = summarizeAging(items, asOf);
  const phoneByTenant = new Map(overdue.map((p) => [p.contract.tenantId, p.contract.tenant.phone]));

  return (
    <div className="print-wide space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/payments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
          العودة للتحصيل
        </Link>
        <PrintButton />
      </div>

      {/* On screen the page is titled by the app around it; on paper it carries nothing at all —
          a sheet of figures with no name, no date and no property it belongs to. */}
      <div className="hidden space-y-1 border-b pb-3 text-center print:block">
        {org?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
        )}
        <h2 className="text-lg font-bold">تقادم الديون</h2>
        <p className="text-xs text-muted-foreground">
          {buildingId ? buildings.find((b) => b.id === buildingId)?.name : "كل العقارات"} · حتى{" "}
          {formatDate(asOf)}
        </p>
      </div>

      <div className="print:hidden">
        <h1 className="text-2xl font-bold">تقادم الديون</h1>
        <p className="text-sm text-muted-foreground">
          المتأخرات موزَّعة بعمرها — الأقدم أولاً، لأنه الأقرب إلى الضياع
        </p>
      </div>

      {buildings.length > 1 && (
        <form action="/payments/aging" className="flex flex-wrap items-end gap-2 print:hidden">
          <div className="space-y-1">
            <label htmlFor="building" className="block text-xs text-muted-foreground">
              العقار
            </label>
            <select
              id="building"
              name="building"
              defaultValue={buildingId}
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
          <button type="submit" className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">
            عرض
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <PartyPopper className="size-10" />
            <p>لا توجد متأخرات — كل قسط حلّ موعده مسدَّد</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="print-keep grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            {AGING_BUCKETS.map((b) => (
              <div key={b.key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{b.label}</p>
                <p className={cn("text-lg font-bold tabular-nums", BUCKET_TONE[b.key])}>
                  {formatCurrencyPrecise(totals[b.key])}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {totals.total > 0 ? Math.round((totals[b.key] / totals.total) * 100) : 0}% من المتأخر
                </p>
              </div>
            ))}
          </div>

          <Card className="py-0 print:border-0 print:shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>العقار والوحدة</TableHead>
                      <TableHead className="text-left">أقدم دين</TableHead>
                      {AGING_BUCKETS.map((b) => (
                        <TableHead key={b.key} className="text-left">
                          {b.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-left">الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.tenantId}>
                        <TableCell className="font-medium">
                          {canStatement ? (
                            <Link href={`/tenants/${r.tenantId}/statement`} className="hover:underline">
                              {r.tenantName}
                            </Link>
                          ) : (
                            r.tenantName
                          )}
                          <span className="block text-xs text-muted-foreground" dir="ltr">
                            {phoneByTenant.get(r.tenantId) ?? ""}
                          </span>
                          {r.referred && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <ShieldAlert className="size-3" />
                              محال إلى ناجز
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.places.join("، ")}
                          <span className="block text-xs tabular-nums">{lateInstalments(r.instalments)}</span>
                        </TableCell>
                        <TableCell className="text-left tabular-nums">
                          <span className={cn(r.oldestDays > 90 && "font-medium text-red-600")}>
                            {r.oldestDays} يوماً
                          </span>
                        </TableCell>
                        {AGING_BUCKETS.map((b) => (
                          <TableCell
                            key={b.key}
                            className={cn(
                              "text-left tabular-nums",
                              BUCKET_TONE[b.key],
                              // On a phone the row is a card; a bucket holding nothing is a line
                              // of noise between the ones that matter.
                              r.buckets[b.key] <= 0 && "cell-blank"
                            )}
                          >
                            {r.buckets[b.key] > 0 ? formatCurrencyPrecise(r.buckets[b.key]) : "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-left font-bold tabular-nums">
                          {formatCurrencyPrecise(r.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/60 font-bold">
                      <TableCell>الإجمالي</TableCell>
                      <TableCell className="text-sm tabular-nums">{lateInstalments(totals.instalments)}</TableCell>
                      <TableCell />
                      {AGING_BUCKETS.map((b) => (
                        <TableCell key={b.key} className={cn("text-left tabular-nums", BUCKET_TONE[b.key])}>
                          {formatCurrencyPrecise(totals[b.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-left tabular-nums">{formatCurrencyPrecise(totals.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs leading-6 text-muted-foreground">
            «أقدم دين» عمر أقدم قسط لم يُسدَّد لهذا المستأجر بالأيام. والصف يجمع كل وحدات المستأجر لأن الدين
            يتبع المستأجر لا الوحدة. وما تجاوز التسعين يوماً لم يعد مكالمة: خصمٌ من التأمين، أو إحالة إلى
            ناجز، أو عقد لا يُجدَّد. واضغط اسم المستأجر لكشف حسابه.
          </p>
        </>
      )}
    </div>
  );
}
