import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTenantDialog, EditTenantDialog } from "@/components/tenants/tenant-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteTenant } from "@/lib/actions/tenants";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { UserRound } from "lucide-react";

export default async function TenantsPage(props: PageProps<"/tenants">) {
  const user = await requireUser();
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("tenants.edit");
  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const extraParams: Record<string, string> = q ? { q } : {};

  const scopeFilter =
    canManage
      ? undefined
      : { contracts: { some: { unit: { building: { ownerId: user.ownerId ?? "__none__" } } } } };
  const where = {
    ...scopeFilter,
    ...(q ? { name: { contains: q } } : {}),
  };

  const total = await prisma.tenant.count({ where });
  const { skip, take } = paginate(total, page, size);

  const tenants = await prisma.tenant.findMany({
    where,
    include: { contracts: { include: { unit: { include: { building: true } } } } },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المستأجرين</h1>
          <p className="text-sm text-muted-foreground">سجل المستأجرين وعقودهم</p>
        </div>
        {canManage && <CreateTenantDialog />}
      </div>

      <SearchInput basePath="/tenants" defaultValue={q} placeholder="بحث بالاسم..." />

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <UserRound className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا يوجد مستأجرون مسجلون بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/tenants" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>الوحدة الحالية</TableHead>
                      <TableHead>عدد العقود</TableHead>
                      {canManage && <TableHead className="w-24">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((t) => {
                      const activeContract = t.contracts.find((c) => c.status === "ACTIVE");
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell dir="ltr" className="text-right">{t.phone ?? "—"}</TableCell>
                          <TableCell>
                            {activeContract ? `${activeContract.unit.building.name} - ${activeContract.unit.unitNumber}` : "—"}
                          </TableCell>
                          <TableCell>{t.contracts.length}</TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <EditTenantDialog tenant={t} />
                                <DeleteButton action={deleteTenant.bind(null, t.id)} permission="tenants.delete" title="حذف المستأجر" description="لا يمكن حذف مستأجر مرتبط بعقود." />
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

          <PaginationNav basePath="/tenants" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
