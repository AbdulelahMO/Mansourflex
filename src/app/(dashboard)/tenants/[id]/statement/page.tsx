import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { requireUser, buildingScope } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/contracts/print-button";
import { contractStatement } from "@/lib/tenant-statement";
import { annualRent } from "@/lib/rent-value";
import { formatCurrencyPrecise, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Fact } from "@/components/statements/fact";

/** A day given as text, read in local time so the timezone cannot shift it. */
function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "شهرية",
  QUARTERLY: "ربع سنوية",
  SEMI_ANNUAL: "نصف سنوية",
  ANNUAL: "سنوية",
  ONE_TIME: "دفعة واحدة",
};

/**
 * The tenant's account on one contract, as a running ledger.
 *
 * Per contract rather than per person: what is disputed at a counter is a lease — its instalments,
 * its receipts, its deposit — and a page that added two units' rent into one balance could not be
 * handed to either landlord's file. The tenant's other contracts stay one click away above, since
 * the debt follows the tenant and whoever is reading needs to know the rest of it exists.
 */
export default async function TenantStatementPage(props: PageProps<"/tenants/[id]/statement">) {
  const { id } = await props.params;
  const user = await requireUser();
  await requirePagePermission("statements.tenant");
  const scope = buildingScope(user);
  const params = await props.searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      nationalId: true,
      contracts: {
        where: { unit: { building: scope } },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          contractNumber: true,
          status: true,
          startDate: true,
          endDate: true,
          rentAmount: true,
          amountType: true,
          increasePercent: true,
          vatRate: true,
          paymentFrequency: true,
          unit: { select: { unitNumber: true, building: { select: { name: true } } } },
        },
      },
    },
  });
  if (!tenant) notFound();

  if (tenant.contracts.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/tenants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
          العودة للمستأجرين
        </Link>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            لا توجد عقود على {tenant.name} — الكشف يُبنى من عقد.
          </CardContent>
        </Card>
      </div>
    );
  }

  // The live lease is what someone almost always came to look at; failing that, the latest one.
  const requested = typeof params.contract === "string" ? params.contract : "";
  const selected =
    tenant.contracts.find((c) => c.id === requested) ??
    tenant.contracts.find((c) => c.status === "ACTIVE") ??
    tenant.contracts[0];

  const from = parseDate(params.from);
  const toRaw = parseDate(params.to);
  // The ledger stops at today unless asked otherwise: an instalment falling due next spring is not
  // a debt, and a balance that counted the whole lease would tell a tenant who owes nothing that
  // they owe a year's rent. What is coming is listed below the ledger instead.
  const closing = toRaw ?? new Date();
  // The whole closing day belongs to the period, so it runs to the last moment of it.
  const to = new Date(closing.getFullYear(), closing.getMonth(), closing.getDate(), 23, 59, 59, 999);

  const [org, { statement, summary }] = await Promise.all([
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
    contractStatement(selected.id, { from, to }),
  ]);

  const owed = statement.totals.balance;

  // The lease's yearly rent is worked out, never copied: `rentAmount` means a year, a whole term,
  // or a first year, depending on how the contract was entered.
  const yearly = annualRent(selected, closing);
  const vatNote =
    selected.vatRate > 0 ? `غير شامل ضريبة ${selected.vatRate}%` : "غير خاضع لضريبة القيمة المضافة";
  const risingNote =
    selected.amountType === "INCREASING"
      ? `السنة ${yearly.yearIndex} — متزايد ${selected.increasePercent ?? 0}% سنوياً · ${vatNote}`
      : vatNote;

  return (
    <div className="print-doc space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/tenants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
          العودة للمستأجرين
        </Link>
        <PrintButton />
      </div>

      {tenant.contracts.length > 1 && (
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 print:hidden">
          {tenant.contracts.map((c) => (
            <Link
              key={c.id}
              href={`/tenants/${tenant.id}/statement?contract=${c.id}`}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap max-md:min-h-11",
                c.id === selected.id ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              <span dir="ltr">{c.contractNumber}</span>
              <span className="ms-2 text-xs text-muted-foreground">
                {c.unit.building.name} - {c.unit.unitNumber}
              </span>
            </Link>
          ))}
        </div>
      )}

      <form action={`/tenants/${tenant.id}/statement`} className="flex flex-wrap items-end gap-2 print:hidden">
        <input type="hidden" name="contract" value={selected.id} />
        <div className="space-y-1">
          <label htmlFor="from" className="block text-xs text-muted-foreground">
            من تاريخ
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={typeof params.from === "string" ? params.from : ""}
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
            defaultValue={typeof params.to === "string" ? params.to : ""}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
        <button type="submit" className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">
          عرض الكشف
        </button>
        {(from || toRaw) && (
          <Link
            href={`/tenants/${tenant.id}/statement?contract=${selected.id}`}
            className="flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            كامل التاريخ
          </Link>
        )}
      </form>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6 sm:p-8 print:p-0">
          <header className="space-y-4 border-b pb-4">
            <div className="space-y-1 text-center">
              {org?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
              )}
              <h1 className="text-lg font-bold">كشف حساب المستأجر</h1>
              {/* The statement is dated, and says so: it is the account as it stood that day, which
                  is also why nothing that has not yet fallen due appears anywhere below. */}
              <p className="text-xs text-muted-foreground">
                {from || toRaw
                  ? `الفترة من ${from ? formatDate(from) : "بداية العقد"} إلى ${formatDate(closing)}`
                  : `صدر في ${formatDate(closing)} — ويشمل ما استُحق منذ بداية العقد حتى تاريخه`}
              </p>
            </div>

            {/* Who, which property, and over what term — laid out as labelled facts rather than
                one run-on line, since this is the part a reader checks before the figures. */}
            <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
              <Fact label="المستأجر" value={tenant.name} />
              <Fact label="رقم الهوية" value={tenant.nationalId} />
              <Fact label="الجوال" value={tenant.phone} />
              <Fact label="رقم العقد" value={selected.contractNumber} />
              <Fact
                label="العقار والوحدة"
                value={`${selected.unit.building.name} - وحدة ${selected.unit.unitNumber}`}
              />
              <Fact
                label="مدة العقد"
                value={`${formatDate(selected.startDate)} — ${formatDate(selected.endDate)}`}
              />
              <Fact label="الإيجار السنوي" value={formatCurrencyPrecise(yearly.amount)} note={risingNote} />
              <Fact
                label="القسط ودوريته"
                value={
                  summary.instalment === null
                    ? "—"
                    : `${formatCurrencyPrecise(summary.instalment)} · ${FREQUENCY_LABELS[selected.paymentFrequency] ?? ""}`
                }
                note={selected.vatRate > 0 ? "شامل الضريبة — وهو ما يظهر في الجدول أدناه" : "وهو ما يظهر في الجدول أدناه"}
              />
            </dl>
          </header>

          <div className="print-keep grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            <Figure
              label={owed >= 0 ? "الرصيد المستحق عليه" : "رصيد له (مدفوع مقدماً)"}
              value={formatCurrencyPrecise(Math.abs(owed))}
              tone={owed > 0 ? "text-red-600" : "text-primary"}
            />
            <Figure
              label="المتأخر (حلّ موعده)"
              value={formatCurrencyPrecise(summary.arrears)}
              tone={summary.arrears > 0 ? "text-red-600" : undefined}
            />
            <Figure label="المسدَّد خلال الفترة" value={formatCurrencyPrecise(statement.totals.credited)} />
            <Figure
              label={summary.deposit.applied > 0 ? "التأمين المتبقي" : "التأمين"}
              value={formatCurrencyPrecise(summary.deposit.available)}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead>المستند</TableHead>
                  <TableHead className="text-left">مستحق عليه</TableHead>
                  <TableHead className="text-left">مسدَّد</TableHead>
                  <TableHead className="text-left">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {from && (
                  <TableRow className="bg-muted/40">
                    <TableCell>{formatDate(from)}</TableCell>
                    <TableCell className="font-medium">رصيد ما قبل الفترة</TableCell>
                    <TableCell className="cell-blank">—</TableCell>
                    <TableCell className="text-left cell-blank">—</TableCell>
                    <TableCell className="text-left cell-blank">—</TableCell>
                    <TableCell className="text-left font-medium tabular-nums">
                      {formatCurrencyPrecise(statement.opening)}
                    </TableCell>
                  </TableRow>
                )}

                {statement.lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{formatDate(l.date)}</TableCell>
                    <TableCell>
                      <span className={cn("font-medium", l.unvouched && "text-amber-700")}>{l.label}</span>
                      {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                      {l.unvouched && (
                        <span className="block text-xs text-amber-700">يلزم إصدار سند قبض له</span>
                      )}
                    </TableCell>
                    <TableCell
                      dir="ltr"
                      className={cn("text-right text-muted-foreground", !l.reference && "cell-blank")}
                    >
                      {l.reference ?? "—"}
                    </TableCell>
                    <TableCell className={cn("text-left tabular-nums", l.kind !== "CHARGE" && "cell-blank")}>
                      {l.kind === "CHARGE" ? formatCurrencyPrecise(l.amount) : "—"}
                    </TableCell>
                    <TableCell className={cn("text-left tabular-nums", l.kind !== "CREDIT" && "cell-blank")}>
                      {l.kind === "CREDIT" ? formatCurrencyPrecise(l.amount) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn("text-left font-medium tabular-nums", l.balance > 0 ? "text-red-600" : "text-muted-foreground")}
                    >
                      {formatCurrencyPrecise(l.balance)}
                    </TableCell>
                  </TableRow>
                ))}

                {statement.lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      لا توجد حركة في هذه الفترة
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="bg-muted/60 font-bold">
                  <TableCell colSpan={3}>الإجمالي</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrencyPrecise(statement.totals.charged)}</TableCell>
                  <TableCell className="text-left tabular-nums">{formatCurrencyPrecise(statement.totals.credited)}</TableCell>
                  <TableCell className={cn("text-left tabular-nums", owed > 0 ? "text-red-600" : "text-primary")}>
                    {formatCurrencyPrecise(owed)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {summary.deposit.held > 0 && (
            <p className="text-xs text-muted-foreground">
              التأمين: {formatCurrencyPrecise(summary.deposit.held)}
              {summary.deposit.applied > 0 && ` — استُهلك منه ${formatCurrencyPrecise(summary.deposit.applied)} في سداد متأخرات`}
              . لا يدخل التأمين في الرصيد أعلاه لأنه أمانة لا إيجار، وما يُخصم منه يظهر في الكشف بسنده.
            </p>
          )}

          {/* What a reader cannot infer from the columns themselves — a negative figure, and the
              absence of everything not yet due. The rest was explanation the page does not need. */}
          <p className="text-xs leading-6 text-muted-foreground">
            الرصيد بالسالب يعني سداداً مقدماً · الكشف حتى تاريخ إصداره ولا يشمل أقساطاً لم يحن موعدها —
            جدول أقساط العقد كاملاً في العقد.
          </p>

          <div className="hidden justify-between pt-10 text-xs print:flex">
            <span>توقيع المستأجر: ....................</span>
            <span>عن {org?.name ?? "الإدارة"}: ....................</span>
          </div>
        </CardContent>
      </Card>

      {summary.unvouched > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          {formatCurrencyPrecise(summary.unvouched)} مسجّلة كتحصيل دون سند قبض. أصدر لها سنداً من صفحة العقد ليستقيم
          الكشف مع المستندات.
        </p>
      )}
    </div>
  );
}
