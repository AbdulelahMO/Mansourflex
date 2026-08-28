import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ContractActionsMenu } from "@/components/contracts/contract-actions-menu";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { FileText, Plus } from "lucide-react";

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  TOTAL: "إجمالي",
  ANNUAL: "سنوي",
  INCREASING: "متزايد",
};

const CONTRACT_STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED"] as const;

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "ACTIVE", label: "ساري" },
  { key: "EXPIRING_SOON", label: "قارب على الانتهاء" },
  { key: "EXPIRED", label: "منتهي" },
  { key: "TERMINATED", label: "مفسوخ" },
];

export default async function ContractsPage(props: PageProps<"/contracts">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("contracts.edit");
  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const activeStatus = (CONTRACT_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "all";
  const filterParams: Record<string, string> = activeStatus !== "all" ? { status: activeStatus } : {};
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  const where = {
    unit: { building: scope },
    ...(activeStatus !== "all" ? { status: activeStatus as (typeof CONTRACT_STATUSES)[number] } : {}),
    ...(q
      ? {
          OR: [
            { contractNumber: { contains: q } },
            { tenant: { name: { contains: q } } },
            { unit: { unitNumber: { contains: q } } },
            { unit: { building: { name: { contains: q } } } },
          ],
        }
      : {}),
  };
  const total = await prisma.contract.count({ where });
  const { skip, take } = paginate(total, page, size);

  const contracts = await prisma.contract.findMany({
    where,
    include: { unit: { include: { building: true } }, tenant: true },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العقود</h1>
          <p className="text-sm text-muted-foreground">عقود الإيجار وحالتها</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="size-4" />
              عقد جديد
            </Link>
          </Button>
        )}
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {STATUS_TABS.map((tab) => {
          const qs = new URLSearchParams({
            ...(tab.key !== "all" ? { status: tab.key } : {}),
            ...(q ? { q } : {}),
          }).toString();
          return (
            <Link
              key={tab.key}
              href={`/contracts${qs ? `?${qs}` : ""}`}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap max-md:min-h-11",
                activeStatus === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <SearchInput
        basePath="/contracts"
        defaultValue={q}
        placeholder="بحث برقم العقد أو اسم المستأجر..."
        extraParams={filterParams}
      />

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <FileText className="size-10" />
            <p>{q || activeStatus !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد عقود مسجلة بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/contracts" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>القيمة</TableHead>
                      <TableHead>البداية</TableHead>
                      <TableHead>النهاية</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-14">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium" dir="ltr">
                          <Link href={`/contracts/${c.id}`} className="hover:underline">
                            {c.contractNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{c.tenant.name}</TableCell>
                        <TableCell>
                          {c.unit.building.name} - {c.unit.unitNumber}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(c.rentAmount)}
                          <span className="text-xs text-muted-foreground"> ({AMOUNT_TYPE_LABELS[c.amountType]})</span>
                        </TableCell>
                        <TableCell>{formatDate(c.startDate)}</TableCell>
                        <TableCell>{formatDate(c.endDate)}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <ContractActionsMenu id={c.id} status={c.status} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/contracts" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
