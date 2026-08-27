import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateOwnerDialog, EditOwnerDialog } from "@/components/owners/owner-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteOwner } from "@/lib/actions/owners";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { Users } from "lucide-react";

export default async function OwnersPage(props: PageProps<"/owners">) {
  await requirePagePermission("owners.view");
  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const extraParams: Record<string, string> = q ? { q } : {};

  const where = q ? { name: { contains: q } } : undefined;

  const total = await prisma.owner.count({ where });
  const { skip, take } = paginate(total, page, size);

  const owners = await prisma.owner.findMany({
    where,
    include: { user: true, buildings: true },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الملاك</h1>
          <p className="text-sm text-muted-foreground">إدارة ملاك العقارات وحساباتهم</p>
        </div>
        <CreateOwnerDialog />
      </div>

      <SearchInput basePath="/owners" defaultValue={q} placeholder="بحث بالاسم..." />

      {owners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا يوجد ملاك مسجلون بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/owners" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>البريد الإلكتروني</TableHead>
                      <TableHead>عدد المباني</TableHead>
                      <TableHead>حساب دخول</TableHead>
                      <TableHead className="w-24">خيارات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owners.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">
                          <Link href={`/owners/${o.id}`} className="hover:underline">
                            {o.name}
                          </Link>
                        </TableCell>
                        <TableCell>{o.ownerType === "COMPANY" ? "شركة / مؤسسة" : o.ownerType === "INDIVIDUAL" ? "فرد" : "—"}</TableCell>
                        <TableCell dir="ltr" className="text-right">{o.phone ?? "—"}</TableCell>
                        <TableCell dir="ltr" className="text-right">{o.email ?? "—"}</TableCell>
                        <TableCell>{o.buildings.length}</TableCell>
                        <TableCell>
                          {o.user ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0">مفعّل</Badge>
                          ) : (
                            <Badge variant="secondary" className="border-0">غير مفعّل</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <EditOwnerDialog owner={o} />
                            <DeleteButton action={deleteOwner.bind(null, o.id)} permission="owners.delete" title="حذف المالك" description="لا يمكن حذف مالك مرتبط بمباني." />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/owners" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
