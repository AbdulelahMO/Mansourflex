import Link from "next/link";
import { ChevronRight, AlarmClock, ArrowUp, ArrowDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { syncOverduePayments } from "@/lib/actions/payments";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { MarkPaidDialog } from "@/components/payments/mark-paid-dialog";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate, buildPageHref } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";

function daysOverdue(dueDate: Date) {
  const days = Math.floor((Date.now() - dueDate.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

export default async function OverduePaymentsPage(props: PageProps<"/payments/overdue">) {
  await syncOverduePayments();

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
    "/payments/overdue",
    { size, page: 1 },
    { ...(nextSort !== "asc" ? { sort: nextSort } : {}), ...(q ? { q } : {}) }
  );

  const outstandingStatuses: ("PENDING" | "OVERDUE" | "PARTIAL")[] = ["PENDING", "OVERDUE", "PARTIAL"];
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const where = {
    contract: { unit: { building: scope } },
    status: { in: outstandingStatuses },
    dueDate: { lte: endOfToday },
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

  const payments = await prisma.payment.findMany({
    where,
    include: { contract: { include: { tenant: true, unit: { include: { building: true } } } } },
    orderBy: { dueDate: sort },
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
        <h1 className="text-2xl font-bold">الدفعات المتأخرة</h1>
        <p className="text-sm text-muted-foreground">
          جميع الدفعات المستحقة والمتأخرة والمدفوعة جزئياً حتى تاريخ اليوم، مرتبة حسب تاريخ الاستحقاق
        </p>
      </div>

      <SearchInput
        basePath="/payments/overdue"
        defaultValue={q}
        placeholder="بحث بالمستأجر أو رقم العقد..."
        extraParams={sortParams}
      />

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <AlarmClock className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا توجد دفعات غير محصّلة حالياً"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/payments/overdue" total={total} page={page} size={size} extraParams={extraParams} />

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
                      <TableHead className="text-left">أيام التأخير</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-36">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0));
                      const days = daysOverdue(p.dueDate);
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
                          <TableCell className="text-left font-medium text-red-600 tabular-nums">
                            {formatCurrency(remaining)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-left tabular-nums",
                              days > 0 ? "font-medium text-red-600" : "text-muted-foreground"
                            )}
                          >
                            {days > 0 ? `${days} يوم` : "—"}
                          </TableCell>
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

          <PaginationNav basePath="/payments/overdue" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
