import Link from "next/link";
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
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wallet, Eye } from "lucide-react";

// Every PaymentStatus needs a tab, otherwise those payments are only reachable through "الكل".
const TABS = [
  { key: "all", label: "الكل" },
  { key: "PENDING", label: "مستحقة" },
  { key: "OVERDUE", label: "متأخرة" },
  { key: "PARTIAL", label: "مدفوعة جزئياً" },
  { key: "PAID", label: "مدفوعة" },
];

export default async function PaymentsPage(props: PageProps<"/payments">) {
  await syncOverduePayments();

  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("payments.pay");
  const params = await props.searchParams;
  const activeTab = typeof params.status === "string" ? params.status : "all";
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const extraParams: Record<string, string> = {
    ...(activeTab !== "all" ? { status: activeTab } : {}),
    ...(q ? { q } : {}),
  };

  const where = {
    contract: { unit: { building: scope } },
    ...(activeTab !== "all" ? { status: activeTab as "PENDING" | "OVERDUE" | "PAID" | "PARTIAL" } : {}),
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

  const include = { contract: { include: { tenant: true, unit: { include: { building: true } } } } };
  const orderBy = { dueDate: "asc" } as const;

  /**
   * Under "الكل", settled payments sink below everything still owed, so the page opens on
   * what actually needs collecting. Done as two ordered queries sliced across the page
   * boundary, since the ordering cannot be expressed in a single Prisma `orderBy`.
   */
  let payments;
  if (activeTab === "all") {
    const unpaidWhere = { ...where, status: { not: "PAID" as const } };
    const paidWhere = { ...where, status: "PAID" as const };
    const unpaidTotal = await prisma.payment.count({ where: unpaidWhere });

    const start = skip ?? 0;
    const limit = take ?? total;
    const fromUnpaid = Math.max(0, Math.min(limit, unpaidTotal - start));
    const fromPaid = limit - fromUnpaid;

    const [unpaidRows, paidRows] = await Promise.all([
      fromUnpaid > 0
        ? prisma.payment.findMany({ where: unpaidWhere, include, orderBy, skip: start, take: fromUnpaid })
        : Promise.resolve([]),
      fromPaid > 0
        ? prisma.payment.findMany({
            where: paidWhere,
            include,
            orderBy,
            skip: Math.max(0, start - unpaidTotal),
            take: fromPaid,
          })
        : Promise.resolve([]),
    ]);
    payments = [...unpaidRows, ...paidRows];
  } else {
    payments = await prisma.payment.findMany({ where, include, orderBy, skip, take });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">التحصيل</h1>
        <p className="text-sm text-muted-foreground">متابعة دفعات الإيجار المستحقة والمتأخرة</p>
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/payments" : `/payments?status=${tab.key}`}
            className={cn(
              "flex items-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap max-md:min-h-11",
              activeTab === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <SearchInput
        basePath="/payments"
        defaultValue={q}
        placeholder="بحث بالمستأجر أو رقم العقد..."
        extraParams={activeTab !== "all" ? { status: activeTab } : {}}
      />

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Wallet className="size-10" />
            <p>{q ? "لا توجد نتائج مطابقة" : "لا توجد دفعات في هذا التصنيف"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/payments" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                      <TableHead className="text-left">المتبقي</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-24">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0));
                      const href = `/contracts/${p.contract.id}`;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium" dir="ltr">
                            <Link href={href} className="hover:underline">
                              {p.contract.contractNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link href={href} className="hover:underline">
                              {p.contract.tenant.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={href} className="hover:underline">
                              {p.contract.unit.building.name} - {p.contract.unit.unitNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{formatDate(p.dueDate)}</TableCell>
                          <TableCell className="text-left tabular-nums">{formatCurrency(p.amount)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-left tabular-nums",
                              remaining > 0 ? "font-medium text-red-600" : "text-muted-foreground"
                            )}
                          >
                            {formatCurrency(remaining)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button asChild variant="ghost" size="icon" title="عرض العقد">
                                  <Link href={href}>
                                    <Eye className="size-4" />
                                  </Link>
                                </Button>
                                {/* Partial payments still carry a balance, so they stay collectable here. */}
                                {remaining > 0 && <MarkPaidDialog paymentId={p.id} amount={remaining} />}
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

          <PaginationNav basePath="/payments" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
