import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/format";
import { CreateUnitDialog, EditUnitDialog } from "@/components/units/unit-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteUnit } from "@/lib/actions/units";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { DoorOpen } from "lucide-react";
import Link from "next/link";

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "VACANT", label: "شاغرة" },
  { key: "OCCUPIED", label: "مؤجرة" },
  { key: "MAINTENANCE", label: "صيانة" },
];

const UNIT_STATUSES = ["VACANT", "OCCUPIED", "MAINTENANCE"] as const;

export default async function UnitsPage(props: PageProps<"/units">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("units.edit");
  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const activeStatus = (UNIT_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "all";
  const rawType = typeof params.type === "string" ? params.type.trim() : "";
  // "غير مصنّف" on the dashboard means units with no unitType set at all.
  const isUnclassifiedType = rawType === "غير مصنّف";

  const filterParams: Record<string, string> = {
    ...(activeStatus !== "all" ? { status: activeStatus } : {}),
    ...(rawType ? { type: rawType } : {}),
  };
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  /** Builds a /units URL from the current filters, with the given overrides applied. */
  const unitsHref = (overrides: { status?: string; type?: string }) => {
    const next = { status: activeStatus, type: rawType, ...overrides };
    const qs = new URLSearchParams({
      ...(next.status && next.status !== "all" ? { status: next.status } : {}),
      ...(next.type ? { type: next.type } : {}),
      ...(q ? { q } : {}),
    }).toString();
    return `/units${qs ? `?${qs}` : ""}`;
  };

  const where = {
    building: scope,
    ...(activeStatus !== "all" ? { status: activeStatus as (typeof UNIT_STATUSES)[number] } : {}),
    ...(rawType ? (isUnclassifiedType ? { unitType: null } : { unitType: rawType }) : {}),
    ...(q ? { OR: [{ unitNumber: { contains: q } }, { building: { name: { contains: q } } }] } : {}),
  };
  const total = await prisma.unit.count({ where });
  const { skip, take } = paginate(total, page, size);

  const [units, buildings] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: { building: true },
      orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
      skip,
      take,
    }),
    canManage ? prisma.building.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الوحدات</h1>
          <p className="text-sm text-muted-foreground">
            {rawType ? `وحدات من نوع: ${rawType}` : "جميع الوحدات في كل المباني"}
          </p>
        </div>
        {canManage && buildings.length > 0 && <CreateUnitDialog buildings={buildings} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={unitsHref({ status: tab.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                activeStatus === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {rawType && (
          <Link
            href={unitsHref({ type: "" })}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
          >
            النوع: {rawType}
            <span className="text-muted-foreground">×</span>
          </Link>
        )}
      </div>

      <SearchInput
        basePath="/units"
        defaultValue={q}
        placeholder="بحث برقم الوحدة أو اسم المبنى..."
        extraParams={filterParams}
      />

      {units.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <DoorOpen className="size-10" />
            <p>{q || activeStatus !== "all" || rawType ? "لا توجد نتائج مطابقة" : "لا توجد وحدات مسجلة بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/units" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>المبنى</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الإيجار</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-24">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.unitNumber}</TableCell>
                        <TableCell>
                          <Link href={`/buildings/${u.buildingId}`} className="hover:underline">
                            {u.building.name}
                          </Link>
                        </TableCell>
                        <TableCell>{u.unitType ?? "—"}</TableCell>
                        <TableCell>{formatCurrency(u.rentAmount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} />
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <EditUnitDialog unit={u} />
                              <DeleteButton action={deleteUnit.bind(null, u.id)} permission="units.delete" title="حذف الوحدة" description="سيتم حذف الوحدة نهائياً." />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/units" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
