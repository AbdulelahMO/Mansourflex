import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { deleteBuilding } from "@/lib/actions/buildings";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { Building2, Plus, Pencil } from "lucide-react";

export default async function BuildingsPage(props: PageProps<"/buildings">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("buildings.edit");
  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  // Archived properties are kept out of the working list unless they are asked for.
  const showArchived = params.archived === "1";
  const extraParams: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(showArchived ? { archived: "1" } : {}),
  };

  const where = {
    ...scope,
    ...(showArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(q ? { OR: [{ name: { contains: q } }, { owner: { name: { contains: q } } }] } : {}),
  };

  const archivedCount = await prisma.building.count({ where: { ...scope, archivedAt: { not: null } } });

  const total = await prisma.building.count({ where });
  const { skip, take } = paginate(total, page, size);

  const buildings = await prisma.building.findMany({
    where,
    include: { owner: true, units: true },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المباني</h1>
          <p className="text-sm text-muted-foreground">إدارة المباني والعقارات المسجلة</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/buildings/new">
              <Plus className="size-4" />
              إضافة مبنى
            </Link>
          </Button>
        )}
      </div>

      {(archivedCount > 0 || showArchived) && (
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
          <Link
            href="/buildings"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              !showArchived ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            العاملة
          </Link>
          <Link
            href="/buildings?archived=1"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              showArchived ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            المؤرشفة ({archivedCount})
          </Link>
        </div>
      )}

      <SearchInput
        basePath="/buildings"
        defaultValue={q}
        placeholder="بحث باسم المبنى أو المالك..."
        extraParams={showArchived ? { archived: "1" } : {}}
      />

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Building2 className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا توجد مباني مسجلة بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/buildings" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المبنى</TableHead>
                      <TableHead>المالك</TableHead>
                      <TableHead>المدينة / الحي</TableHead>
                      <TableHead>عدد الوحدات</TableHead>
                      <TableHead>الإشغال</TableHead>
                      {canManage && <TableHead className="w-24">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildings.map((b) => {
                      const occupied = b.units.filter((u) => u.status === "OCCUPIED").length;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            <Link href={`/buildings/${b.id}`} className="hover:underline">
                              {b.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/owners/${b.ownerId}`} className="hover:underline">
                              {b.owner.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {b.city ?? "—"} {b.district ? `- ${b.district}` : ""}
                          </TableCell>
                          <TableCell>{b.units.length}</TableCell>
                          <TableCell>
                            {b.units.length > 0 ? `${occupied}/${b.units.length}` : "—"}
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button asChild variant="ghost" size="icon" title="تعديل المبنى">
                                  <Link href={`/buildings/${b.id}/edit`}>
                                    <Pencil className="size-4" />
                                  </Link>
                                </Button>
                                <DeleteButton
                                  action={deleteBuilding.bind(null, b.id)}
                                  permission="buildings.delete" title="حذف المبنى"
                                  description="يُحذف المبنى وكل ما يتبعه: وحداته وعقوده ودفعاته ومستنداته ومصروفاته وصوره. للاحتفاظ بالسجلات استخدم «الأرشفة» بدلاً من الحذف."
                                />
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/buildings" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
