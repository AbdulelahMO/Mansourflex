import Link from "next/link";
import { ChevronRight, CalendarClock, ArrowUp, ArrowDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate, buildPageHref } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { MarkPaidDialog } from "@/components/payments/mark-paid-dialog";

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

export default async function UpcomingPaymentsPage(props: PageProps<"/payments/upcoming">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("payments.pay");
  const params = await props.searchParams;

  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const sort = params.sort === "desc" ? "desc" : "asc";
  const nextSort = sort === "asc" ? "desc" : "asc";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sortParams: Record<string, string> = sort !== "asc" ? { sort } : {};
  const extraParams: Record<string, string> = { ...sortParams, ...(q ? { q } : {}) };
  const sortHref = buildPageHref(
    "/payments/upcoming",
    { size, page: 1 },
    { ...(nextSort !== "asc" ? { sort: nextSort } : {}), ...(q ? { q } : {}) }
  );

  const where = {
    contract: { unit: { building: scope } },
    status: "PENDING" as const,
    dueDate: { gte: new Date(), lte: addDays(30) },
    ...(q
      ? {
          OR: [
            { contract: { tenant: { name: { contains: q } } } },
            { contract: { contractNumber: { contains: q } } },
            { contract: { unit: { unitNumber: { contains: q } } } },
            { contract: { unit: { building: { name: { contains: q } } } } },
          ],
        }
      : {}),
  };

  const total = await prisma.payment.count({ where });
  const { skip, take } = paginate(total, page, size);

  const [payments, allMatching] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { contract: { include: { tenant: true, unit: { include: { building: true } } } } },
      orderBy: { dueDate: sort },
      skip,
      take,
    }),
    prisma.payment.findMany({ where, select: { amount: true, paidAmount: true } }),
  ]);

  const totalUpcoming = allMatching.reduce((sum, p) => sum + (p.amount - (p.paidAmount ?? 0)), 0);

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للرئيسية
      </Link>

      <div>
        <h1 className="text-2xl font-bold">الدفعات القادمة</h1>
        <p className="text-sm text-muted-foreground">الدفعات المستحقة خلال الـ٣٠ يوماً القادمة ولم يحن موعدها بعد</p>
      </div>

      <SearchInput
        basePath="/payments/upcoming"
        defaultValue={q}
        placeholder="بحث بالمستأجر أو رقم العقد..."
        extraParams={sortParams}
      />

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <CalendarClock className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا توجد دفعات قادمة خلال الـ٣٠ يوماً القادمة"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              إجمالي الدفعات القادمة: <span className="font-bold tabular-nums">{formatCurrency(totalUpcoming)}</span>
            </p>
          </div>

          <PaginationTopBar basePath="/payments/upcoming" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>
                        <Link href={sortHref} className="inline-flex items-center gap-1 hover:text-foreground">
                          تاريخ الاستحقاق
                          {sort === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                        </Link>
                      </TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                      <TableHead className="text-left">المتبقي</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-14">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0));
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium" dir="ltr">
                            <Link href={`/contracts/${p.contract.id}`} className="hover:underline">
                              {p.contract.contractNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link href={`/contracts/${p.contract.id}`} className="hover:underline">
                              {p.contract.tenant.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/contracts/${p.contract.id}`} className="hover:underline">
                              {p.contract.unit.building.name} - {p.contract.unit.unitNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{formatDate(p.dueDate)}</TableCell>
                          <TableCell className="text-left tabular-nums">{formatCurrency(p.amount)}</TableCell>
                          <TableCell className="text-left font-medium tabular-nums">{formatCurrency(remaining)}</TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <MarkPaidDialog paymentId={p.id} amount={remaining} />
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

          <PaginationNav basePath="/payments/upcoming" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
