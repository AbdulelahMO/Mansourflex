import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { Handshake, Plus, Eye, Pencil } from "lucide-react";

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "ACTIVE", label: "سارية" },
  { key: "EXPIRED", label: "منتهية" },
  { key: "TERMINATED", label: "مفسوخة" },
];

const AGREEMENT_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED"] as const;

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "سارية",
  EXPIRED: "منتهية",
  TERMINATED: "مفسوخة",
};

const STATUS_TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-700",
  TERMINATED: "bg-red-100 text-red-700",
};

export default async function AgreementsPage(props: PageProps<"/agreements">) {
  await requirePagePermission("agreements.view");
  const params = await props.searchParams;

  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const activeStatus = (AGREEMENT_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "all";
  const filterParams: Record<string, string> = activeStatus !== "all" ? { status: activeStatus } : {};
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  const where = {
    ...(activeStatus !== "all" ? { status: activeStatus as (typeof AGREEMENT_STATUSES)[number] } : {}),
    ...(q
      ? {
          OR: [
            { agreementNumber: { contains: q } },
            { owner: { name: { contains: q } } },
            { buildings: { some: { building: { name: { contains: q } } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.managementAgreement.count({ where });
  const { skip, take } = paginate(total, page, size);

  const agreements = await prisma.managementAgreement.findMany({
    where,
    include: { owner: true, buildings: { include: { building: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">اتفاقيات الإدارة</h1>
          <p className="text-sm text-muted-foreground">اتفاقيات إدارة الأملاك مع الملاك وشروطها وصلاحياتها</p>
        </div>
        <Button asChild>
          <Link href="/agreements/new">
            <Plus className="size-4" />
            اتفاقية جديدة
          </Link>
        </Button>
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
              href={`/agreements${qs ? `?${qs}` : ""}`}
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
        basePath="/agreements"
        defaultValue={q}
        placeholder="بحث برقم الاتفاقية أو المالك أو المبنى..."
        extraParams={filterParams}
      />

      {agreements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Handshake className="size-10" />
            <p>{q || activeStatus !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد اتفاقيات مسجّلة بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/agreements" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الاتفاقية</TableHead>
                      <TableHead>المالك</TableHead>
                      <TableHead>المبنى</TableHead>
                      <TableHead>البداية</TableHead>
                      <TableHead>النهاية</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-24">خيارات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium" dir="ltr">
                          <Link href={`/agreements/${a.id}`} className="hover:underline">
                            {a.agreementNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/owners/${a.ownerId}`} className="hover:underline">
                            {a.owner.name}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-72 truncate">
                          {a.buildings.map((b) => b.building.name).join("، ") || "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDate(a.startDate)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(a.endDate)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("border-0 font-medium", STATUS_TONES[a.status])}>
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button asChild variant="ghost" size="icon" title="عرض الاتفاقية">
                              <Link href={`/agreements/${a.id}`}>
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" title="تعديل الاتفاقية">
                              <Link href={`/agreements/${a.id}/edit`}>
                                <Pencil className="size-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/agreements" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
