import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet, Home, ReceiptText, FileText, Building2, Paperclip } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ownerPortalData } from "@/lib/owner-portal";
import { CATEGORY_LABELS } from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = {
  month: "هذا الشهر",
  year: "هذا العام",
  all: "منذ البداية",
} as const;
type PeriodKey = keyof typeof PERIODS;

const UNIT_STATUS: Record<string, { label: string; tone: string }> = {
  OCCUPIED: { label: "مؤجرة", tone: "bg-emerald-100 text-emerald-700" },
  VACANT: { label: "شاغرة", tone: "bg-amber-100 text-amber-800" },
  MAINTENANCE: { label: "صيانة", tone: "bg-slate-100 text-slate-700" },
};

function periodRange(period: PeriodKey) {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  if (period === "year") return { from: new Date(now.getFullYear(), 0, 1), to };
  return { from: new Date(0), to };
}

/**
 * The owner's own view of their properties. It answers their questions in the order they
 * ask them — what am I owed, what came in, what went out — and deliberately shows nothing
 * about tenants beyond name and payment standing.
 */
export default async function OwnerPortalPage(props: PageProps<"/portal">) {
  const user = await requireUser();
  if (user.role !== "OWNER" || !user.ownerId) notFound();

  const params = await props.searchParams;
  const period: PeriodKey = params.period === "month" || params.period === "all" ? params.period : "year";

  const [owner, data] = await Promise.all([
    prisma.owner.findUnique({ where: { id: user.ownerId }, select: { name: true } }),
    ownerPortalData(user.ownerId, periodRange(period)),
  ]);
  if (!owner) notFound();

  const { totals, occupancy, accounts, buildings, units, contracts, expenses, remittances, agreements } = data;
  const buildingName = new Map(buildings.map((b) => [b.id, b.name]));
  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مرحباً {owner.name}</h1>
          <p className="text-sm text-muted-foreground">ملخّص أملاكك وحسابك لدى مدير الأملاك</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
            <Link
              key={key}
              href={key === "year" ? "/portal" : `/portal?period=${key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                period === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PERIODS[key]}
            </Link>
          ))}
        </div>
      </div>

      {/* The question the owner opens the portal to answer. */}
      <Card className={cn("border-2", totals.balance >= 0 ? "border-primary/30" : "border-red-300")}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {totals.balance >= 0 ? "مستحقك لدى مدير الأملاك" : "مستحق على حسابك لمدير الأملاك"}
            </p>
            <p className={cn("text-3xl font-bold", totals.balance >= 0 ? "text-primary" : "text-red-600")}>
              {formatCurrency(Math.abs(totals.balance))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              محصّل {formatCurrency(totals.collected)} − مصروفات {formatCurrency(totals.ownerExpenses)} − عمولة إدارة{" "}
              {formatCurrency(totals.commission)} − مورَّد لك {formatCurrency(totals.remitted)}
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="size-6" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Building2, label: "عقاراتك", value: `${buildings.length}`, hint: `${units.length} وحدة` },
          {
            icon: Home,
            label: "الإشغال",
            value: occupancy.total ? `${Math.round((occupancy.occupied / occupancy.total) * 100)}%` : "—",
            hint: `${occupancy.occupied} مؤجرة · ${occupancy.vacant} شاغرة · ${occupancy.maintenance} صيانة`,
          },
          {
            icon: ReceiptText,
            label: "مصروفات على حسابك",
            value: formatCurrency(totals.ownerExpenses),
            hint: `${expenses.length} مصروف خلال الفترة`,
          },
          {
            icon: FileText,
            label: "متأخرات على المستأجرين",
            value: formatCurrency(data.arrearsTotal),
            hint: "يتابعها مدير الأملاك",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between gap-2 py-4">
              <div className="min-w-0">
                <p className="text-lg font-bold tabular-nums">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </div>
              <s.icon className="size-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <CardTitle className="text-base">حساب كل عقار</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/owners/${user.ownerId}/statement`}>كشف حساب مفصّل</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableHead className="text-left">عمولة الإدارة</TableHead>
                  <TableHead className="text-left">مستحقك</TableHead>
                  <TableHead className="text-left">المحوَّل لك</TableHead>
                  <TableHead className="text-left">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.buildingId}>
                    <TableCell className="font-medium">
                      {a.buildingName}
                      <span className="block text-xs text-muted-foreground">
                        {a.commissionPercent > 0 ? `عمولة ${a.commissionPercent}%` : "بلا اتفاقية سارية"}
                      </span>
                    </TableCell>
                    <TableCell className="text-left">
                      <span className="font-medium tabular-nums">
                        {a.units ? Math.round((a.occupiedUnits / a.units) * 100) : 0}%
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {a.occupiedUnits} من {a.units}
                      </span>
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(a.billed)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(a.collected)}</TableCell>
                    <TableCell
                      className={cn("text-left tabular-nums", a.outstanding > 0 ? "text-red-600" : "text-muted-foreground")}
                    >
                      {formatCurrency(a.outstanding)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(a.ownerExpenses)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(a.commission)}
                    </TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(a.payableToOwner)}</TableCell>
                    <TableCell className="text-left tabular-nums text-muted-foreground">
                      {formatCurrency(a.remitted)}
                    </TableCell>
                    <TableCell
                      className={cn("text-left font-bold tabular-nums", a.balance < 0 ? "text-red-600" : "text-primary")}
                    >
                      {formatCurrency(a.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">وحداتك ومستأجروها</CardTitle>
          <p className="text-xs text-muted-foreground">
            متابعة التحصيل من مستأجريك مسؤولية مدير الأملاك — وهذه حالتهم الآن
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المستأجر</TableHead>
                  <TableHead>مدة العقد</TableHead>
                  <TableHead className="text-left">الإيجار</TableHead>
                  <TableHead className="text-left">متأخرات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => {
                  const contract = contracts.find(
                    (c) => c.unit.unitNumber === u.unitNumber && c.unit.buildingId === u.buildingId && c.status === "ACTIVE"
                  );
                  const arrears = contract
                    ? contract.payments
                        .filter((p) => p.status !== "PAID" && p.dueDate <= now)
                        .reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0)
                    : 0;
                  const status = UNIT_STATUS[u.status] ?? { label: u.status, tone: "" };

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.unitNumber}
                        <span className="block text-xs text-muted-foreground">{buildingName.get(u.buildingId)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("border-0 font-medium", status.tone)}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract?.tenant.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {contract ? `${formatDate(contract.startDate)} — ${formatDate(contract.endDate)}` : "—"}
                      </TableCell>
                      <TableCell className="text-left tabular-nums">
                        {contract ? formatCurrency(contract.rentAmount) : "—"}
                      </TableCell>
                      <TableCell className={cn("text-left tabular-nums", arrears > 0 && "font-bold text-red-600")}>
                        {arrears > 0 ? formatCurrency(arrears) : "—"}
                      </TableCell>
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
          <CardTitle className="text-base">المصروفات على حسابك ({expenses.length})</CardTitle>
          <p className="text-xs text-muted-foreground">ما صُرف على عقاراتك خلال الفترة، بمرفقاته</p>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد مصروفات خلال هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العقار / الوحدة</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المورّد</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الفاتورة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(e.expenseDate)}</TableCell>
                      <TableCell>
                        {buildingName.get(e.buildingId)}
                        <span className="block text-xs text-muted-foreground">
                          {e.unit ? `وحدة ${e.unit.unitNumber}` : "عام على المبنى"}
                        </span>
                      </TableCell>
                      <TableCell>{CATEGORY_LABELS[e.category]}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{e.vendor ?? "—"}</TableCell>
                      <TableCell className="text-left tabular-nums">{formatCurrency(e.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border-0 font-medium",
                            e.paidDate ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {e.paidDate ? `صُرف ${formatDate(e.paidDate)}` : "غير مدفوع"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.fileUrl ? (
                          <a
                            href={`/api/files/${e.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Paperclip className="size-3.5" />
                            عرض
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">ما استلمته ({remittances.length})</CardTitle>
            <p className="text-xs text-muted-foreground">سندات التوريد الصادرة لك خلال الفترة</p>
          </CardHeader>
          <CardContent className="p-0">
            {remittances.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">لم تُسجَّل توريدات خلال هذه الفترة</p>
            ) : (
              <div className="divide-y">
                {remittances.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", r.cancelledAt && "text-muted-foreground line-through")}>
                        {formatCurrency(r.amount)} — {r.building.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.remittedAt)}
                        {r.method ? ` · ${r.method}` : ""}
                        {r.reference ? ` · ${r.reference}` : ""}
                      </p>
                    </div>
                    {r.cancelledAt ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">ملغى</span>
                    ) : (
                      r.documents[0] && (
                        <Link
                          href={`/documents/${r.documents[0].id}`}
                          className="text-xs text-primary hover:underline"
                          dir="ltr"
                        >
                          {r.documents[0].documentNumber}
                        </Link>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">اتفاقيات الإدارة ({agreements.length})</CardTitle>
            <p className="text-xs text-muted-foreground">شروط إدارة عقاراتك ونسبة العمولة</p>
          </CardHeader>
          <CardContent className="p-0">
            {agreements.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">لا توجد اتفاقيات مسجّلة</p>
            ) : (
              <div className="divide-y">
                {agreements.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span dir="ltr">{a.agreementNumber}</span>
                        {a.buildings[0] && ` — ${a.buildings[0].building.name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.startDate)} — {formatDate(a.endDate)}
                        {a.buildings[0] && ` · عمولة ${a.buildings[0].commissionPercent}%`}
                        {a.settlement && ` · صُفّيت في ${formatDate(a.settlement.settledAt)}`}
                      </p>
                    </div>
                    {a.fileUrl && (
                      <a
                        href={`/api/files/${a.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="size-3.5" />
                        النسخة الموقّعة
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
