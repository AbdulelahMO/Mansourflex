import Link from "next/link";
import { ChevronRight, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";

function daysRemaining(endDate: Date) {
  return Math.ceil((endDate.getTime() - Date.now()) / 86_400_000);
}

export default async function ExpiringContractsPage(props: PageProps<"/contracts/expiring">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  const params = await props.searchParams;

  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  // Buckets mirror the dashboard card exactly: 30 = within a month, 60 = the second month, 90 = the third.
  const bucket = params.bucket === "30" || params.bucket === "60" || params.bucket === "90" ? params.bucket : null;
  const bucketLabels: Record<string, string> = {
    "30": "خلال شهر",
    "60": "خلال شهرين",
    "90": "خلال 3 أشهر",
  };
  const filterParams: Record<string, string> = bucket ? { bucket } : {};
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  const now = new Date();
  const dayMs = 86_400_000;
  const upperDays = bucket ? Number(bucket) : 90;
  const lowerDays = bucket ? Number(bucket) - 30 : 0;
  const rangeStart = new Date(now.getTime() + lowerDays * dayMs);
  const rangeEnd = new Date(now.getTime() + upperDays * dayMs);

  const where = {
    status: "ACTIVE" as const,
    unit: { building: scope },
    endDate: { gte: rangeStart, lte: rangeEnd },
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
    orderBy: { endDate: "asc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للرئيسية
      </Link>

      <div>
        <h1 className="text-2xl font-bold">عقود على وشك الانتهاء</h1>
        <p className="text-sm text-muted-foreground">
          {bucket
            ? `العقود السارية التي تنتهي ${bucketLabels[bucket]}، مرتبة حسب تاريخ النهاية`
            : "العقود السارية اللي باقي على انتهائها 3 أشهر أو أقل، مرتبة حسب تاريخ النهاية"}
        </p>
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {[
          { key: "", label: "الكل" },
          { key: "30", label: "خلال شهر" },
          { key: "60", label: "خلال شهرين" },
          { key: "90", label: "خلال 3 أشهر" },
        ].map((tab) => {
          const qs = new URLSearchParams({ ...(tab.key ? { bucket: tab.key } : {}), ...(q ? { q } : {}) }).toString();
          return (
            <Link
              key={tab.key || "all"}
              href={`/contracts/expiring${qs ? `?${qs}` : ""}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                (bucket ?? "") === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <SearchInput
        basePath="/contracts/expiring"
        defaultValue={q}
        placeholder="بحث برقم العقد أو اسم المستأجر..."
        extraParams={filterParams}
      />

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <CalendarClock className="size-10" />
            <p>{q || bucket ? "لا توجد نتائج مطابقة" : "لا توجد عقود على وشك الانتهاء خلال 3 أشهر"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/contracts/expiring" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>تاريخ النهاية</TableHead>
                      <TableHead className="text-left">القيمة</TableHead>
                      <TableHead className="text-left">الأيام المتبقية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => {
                      const days = daysRemaining(c.endDate);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium" dir="ltr">
                            <Link href={`/contracts/${c.id}`} className="hover:underline">
                              {c.contractNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/contracts/${c.id}`} className="hover:underline">
                              {c.tenant.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/contracts/${c.id}`} className="hover:underline">
                              {c.unit.building.name} - {c.unit.unitNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{formatDate(c.endDate)}</TableCell>
                          <TableCell className="text-left tabular-nums">{formatCurrency(c.rentAmount)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-left tabular-nums font-medium",
                              days <= 30 ? "text-red-600" : days <= 60 ? "text-amber-600" : "text-muted-foreground"
                            )}
                          >
                            {days} يوم
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/contracts/expiring" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
