import { FileText, Wallet, Home, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { RichStatCard, type StatRowItem } from "@/components/dashboard/rich-stat-card";
import { OutstandingContractsList, type OutstandingContract } from "@/components/dashboard/outstanding-contracts-list";
import { TopCollectionsChart, type InsightItem, type UpcomingPaymentItem } from "@/components/dashboard/top-collections-chart";
import { SectorDonutChart, type SectorSlice } from "@/components/dashboard/sector-donut-chart";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { formatCurrency } from "@/lib/format";

const SECTOR_COLORS: Record<string, string> = {
  "تجاري": "#0d3b44",
  "سكني": "#5cb57a",
  "تجاري - سكني": "#e3b23c",
  "صناعي": "#e07a5f",
  "زراعي": "#8fd1a0",
  "غير محدد": "#a8a29e",
};

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

/** Dashboard figures answer "how are we doing now", so the year is the useful default. */
const PERIODS = {
  month: "هذا الشهر",
  year: "هذا العام",
  all: "منذ البداية",
} as const;
type PeriodKey = keyof typeof PERIODS;

function periodStart(period: PeriodKey) {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default async function DashboardPage(props: PageProps<"/">) {
  const user = await requireUser();
  const scope = buildingScope(user);

  const params = await props.searchParams;
  const period: PeriodKey = params.period === "month" || params.period === "all" ? params.period : "year";
  const from = periodStart(period);

  // An archived property is out of management, so it no longer moves the operating figures.
  const activeScope = { ...scope, archivedAt: null };

  const unpaidStatuses = ["PENDING", "OVERDUE", "PARTIAL"] as const;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    buildingsCount,
    unitsRaw,
    tenantsCount,
    ownersCount,
    activeContractsRaw,
    unpaidPayments,
    najizPayments,
    upcomingDuePayments,
    outstandingContractsCount,
    outstandingContractsRaw,
    buildingsWithPayments,
    upcomingPaymentsRaw,
    contractSectorsRaw,
  ] = await Promise.all([
    prisma.building.count({ where: scope }),
    prisma.unit.findMany({ where: { building: activeScope }, select: { unitType: true, status: true } }),
    prisma.tenant.count({
      where:
        user.role === "ADMIN"
          ? undefined
          : { contracts: { some: { unit: { building: { ownerId: user.ownerId ?? "__none__", archivedAt: null } } } } },
    }),
    user.role === "ADMIN" ? prisma.owner.count() : Promise.resolve(0),
    prisma.contract.findMany({ where: { status: "ACTIVE", unit: { building: activeScope } }, select: { endDate: true } }),
    prisma.payment.findMany({
      where: { status: { in: [...unpaidStatuses] }, dueDate: { lte: endOfToday }, contract: { unit: { building: activeScope } } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        najizReferredAt: { not: null },
        status: { in: [...unpaidStatuses] },
        contract: { unit: { building: activeScope } },
      },
      select: { amount: true, paidAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        status: "PENDING",
        dueDate: { gte: new Date(), lte: addDays(30) },
        contract: { unit: { building: activeScope } },
      },
      select: { amount: true, paidAmount: true },
    }),
    // Arrears, not merely an unpaid schedule: a contract signed today has a year of instalments
    // ahead of it and owes nothing yet. The condition matches the figure the card shows —
    // instalments already due and short — so no contract appears in the list at zero.
    prisma.contract.count({
      where: {
        unit: { building: activeScope },
        payments: { some: { status: { in: [...unpaidStatuses] }, dueDate: { lte: endOfToday } } },
      },
    }),
    prisma.contract.findMany({
      where: {
        unit: { building: activeScope },
        payments: { some: { status: { in: [...unpaidStatuses] }, dueDate: { lte: endOfToday } } },
      },
      include: {
        tenant: true,
        unit: { include: { building: true } },
        // Only the instalments the arrears are computed from travel back.
        payments: {
          where: { status: { in: [...unpaidStatuses] }, dueDate: { lte: endOfToday } },
          select: { amount: true, paidAmount: true },
        },
      },
    }),
    prisma.building.findMany({
      where: activeScope,
      include: {
        owner: true,
        units: { include: { contracts: { include: { tenant: true, payments: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { status: "PENDING", contract: { unit: { building: activeScope } } },
      include: { contract: { include: { tenant: true, unit: { include: { building: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.contract.findMany({
      where: { unit: { building: activeScope } },
      select: { unit: { select: { building: { select: { sector: true } } } } },
    }),
  ]);

  // occupancy status buckets
  const vacantCount = unitsRaw.filter((u) => u.status === "VACANT").length;
  const occupiedCount = unitsRaw.filter((u) => u.status === "OCCUPIED").length;
  const maintenanceCount = unitsRaw.filter((u) => u.status === "MAINTENANCE").length;
  const unitsCount = unitsRaw.length;
  const occupancyRate = unitsCount > 0 ? Math.round((occupiedCount / unitsCount) * 100) : 0;

  // occupancy by unit type (up to 2 most common types)
  const typeMap = new Map<string, { total: number; occupied: number }>();
  for (const u of unitsRaw) {
    const type = u.unitType?.trim() || "غير مصنّف";
    const entry = typeMap.get(type) ?? { total: 0, occupied: 0 };
    entry.total++;
    if (u.status === "OCCUPIED") entry.occupied++;
    typeMap.set(type, entry);
  }
  const topTypes = Array.from(typeMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  // contract expiry buckets
  const now = Date.now();
  let expiring30 = 0,
    expiring60 = 0,
    expiring90 = 0;
  for (const c of activeContractsRaw) {
    const days = Math.ceil((c.endDate.getTime() - now) / 86_400_000);
    if (days < 0) continue;
    if (days <= 30) expiring30++;
    else if (days <= 60) expiring60++;
    else if (days <= 90) expiring90++;
  }

  const totalOutstanding = unpaidPayments.reduce((sum, p) => sum + (p.amount - (p.paidAmount ?? 0)), 0);
  const najizTotal = najizPayments.reduce((sum, p) => sum + (p.amount - (p.paidAmount ?? 0)), 0);
  const upcomingTotal = upcomingDuePayments.reduce((sum, p) => sum + (p.amount - (p.paidAmount ?? 0)), 0);
  const collectedPayments = buildingsWithPayments
    .flatMap((b) => b.units.flatMap((u) => u.contracts.flatMap((c) => c.payments)))
    .filter((p) => (p.paidAmount ?? 0) > 0 && (!from || (p.paidDate && p.paidDate >= from)));

  const totalCollected = collectedPayments.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
  const collectionRate =
    totalCollected + totalOutstanding > 0 ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100) : 0;

  // The heaviest arrears first: the card shows eight, and the eight worth chasing are the
  // largest — not the eight most recently signed.
  const outstandingContracts: OutstandingContract[] = outstandingContractsRaw
    .map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber,
      unitLabel: `${c.unit.building.name} - ${c.unit.unitNumber}`,
      tenantName: c.tenant.name,
      outstandingAmount: c.payments.reduce((sum, p) => sum + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0),
    }))
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 8);

  const propertyInsights: InsightItem[] = buildingsWithPayments
    .map((b) => {
      const payments = b.units.flatMap((u) => u.contracts.flatMap((c) => c.payments));
      const collected = payments.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
      const expected = payments.reduce((sum, p) => sum + p.amount, 0);
      return { id: b.id, name: b.name, collected, due: Math.max(0, expected - collected) };
    })
    .filter((b) => b.collected + b.due > 0);

  const ownerMap = new Map<string, InsightItem>();
  for (const b of buildingsWithPayments) {
    const payments = b.units.flatMap((u) => u.contracts.flatMap((c) => c.payments));
    const collected = payments.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
    const expected = payments.reduce((sum, p) => sum + p.amount, 0);
    const due = Math.max(0, expected - collected);
    const entry = ownerMap.get(b.ownerId) ?? { id: b.ownerId, name: b.owner.name, collected: 0, due: 0 };
    entry.collected += collected;
    entry.due += due;
    ownerMap.set(b.ownerId, entry);
  }
  const ownerInsights = Array.from(ownerMap.values()).filter((o) => o.collected + o.due > 0);

  const tenantMap = new Map<string, InsightItem>();
  for (const b of buildingsWithPayments) {
    for (const u of b.units) {
      for (const c of u.contracts) {
        const collected = c.payments.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
        const expected = c.payments.reduce((sum, p) => sum + p.amount, 0);
        const due = Math.max(0, expected - collected);
        const entry = tenantMap.get(c.tenantId) ?? { id: c.tenantId, name: c.tenant.name, collected: 0, due: 0 };
        entry.collected += collected;
        entry.due += due;
        tenantMap.set(c.tenantId, entry);
      }
    }
  }
  const tenantInsights = Array.from(tenantMap.values()).filter((t) => t.collected + t.due > 0);

  const sectorCounts = new Map<string, number>();
  for (const c of contractSectorsRaw) {
    const sector = c.unit.building.sector?.trim() || "غير محدد";
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const sectorData: SectorSlice[] = Array.from(sectorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, color: SECTOR_COLORS[label] ?? SECTOR_COLORS["غير محدد"] }));
  const totalContractsForSector = contractSectorsRaw.length;

  const upcomingPayments: UpcomingPaymentItem[] = upcomingPaymentsRaw.map((p) => ({
    id: p.id,
    name: p.contract.tenant.name,
    sub: `${p.contract.unit.building.name} - ${p.contract.unit.unitNumber}`,
    amount: p.amount,
    dueDate: p.dueDate.toISOString(),
  }));

  const occupancyRows: StatRowItem[][] = [
    [
      { value: vacantCount, label: "شاغرة", tone: "danger", href: "/units?status=VACANT" },
      { value: occupiedCount, label: "مؤجرة", tone: "success", href: "/units?status=OCCUPIED" },
      { value: maintenanceCount, label: "صيانة", href: "/units?status=MAINTENANCE" },
    ],
  ];
  if (topTypes.length > 0) {
    occupancyRows.push(
      topTypes.map(([type, { total, occupied }]) => ({
        value: `${total > 0 ? Math.round((occupied / total) * 100) : 0}%`,
        label: `إشغال ${type}`,
        href: `/units?type=${encodeURIComponent(type)}`,
      }))
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm">نظرة عامة على أملاكك العقارية</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RichStatCard
          icon={Home}
          mainValue={`${occupancyRate}%`}
          mainValueSuffix={`(${unitsCount} وحدات)`}
          mainLabel="معدل الإشغال الكلي"
          rows={occupancyRows}
          footerLabel="العقارات والإشغال"
          footerHref="/units"
        />

        <RichStatCard
          icon={Wallet}
          mainValue={formatCurrency(totalOutstanding)}
          mainLabel="المستحق غير المحصل"
          mainHref="/payments/overdue"
          rows={[
            [
              { value: `${collectionRate}%`, label: "نسبة التحصيل", tone: "success", href: "/payments?status=PAID" },
              {
                value: formatCurrency(totalCollected),
                label: `المحصّل — ${PERIODS[period]}`,
                labelControl: <PeriodSelect value={period} options={PERIODS} />,
              },
            ],
            [
              {
                value: formatCurrency(najizTotal),
                label: "ناجز",
                tone: "danger",
                iconSrc: "/najiz-logo.png",
                href: "/payments/najiz",
              },
              { value: formatCurrency(upcomingTotal), label: "دفعات قادمة", href: "/payments/upcoming" },
            ],
          ]}
          footerLabel="مؤشرات التحصيل"
          footerHref="/payments"
        />

        <RichStatCard
          icon={FileText}
          mainValue={activeContractsRaw.length}
          mainLabel="العقود السارية"
          rows={[
            [
              { value: expiring30, label: "خلال شهر", tone: "danger", href: "/contracts/expiring?bucket=30" },
              { value: expiring60, label: "خلال شهرين", href: "/contracts/expiring?bucket=60" },
              { value: expiring90, label: "خلال 3 أشهر", href: "/contracts/expiring?bucket=90" },
            ],
          ]}
          footerLabel="عقود على وشك الانتهاء"
          footerHref="/contracts/expiring"
        />

        <RichStatCard
          icon={Users}
          mainValue={tenantsCount}
          mainLabel="العملاء"
          rows={[
            user.role === "ADMIN"
              ? [
                  { value: ownersCount, label: "الملاك", href: "/owners" },
                  { value: tenantsCount, label: "المستأجرين", href: "/tenants" },
                ]
              : [
                  { value: buildingsCount, label: "المباني", href: "/buildings" },
                  { value: unitsCount, label: "الوحدات", href: "/units" },
                ],
          ]}
          footerLabel="ملخص عام"
          footerHref="/buildings"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-3">
          <SectorDonutChart data={sectorData} total={totalContractsForSector} />
        </div>
        <div className="lg:col-span-4">
          <TopCollectionsChart
            properties={propertyInsights}
            tenants={tenantInsights}
            owners={ownerInsights}
            upcoming={upcomingPayments}
            showOwners={user.role === "ADMIN"}
          />
        </div>
      </div>

      <OutstandingContractsList items={outstandingContracts} total={outstandingContractsCount} />
    </div>
  );
}
