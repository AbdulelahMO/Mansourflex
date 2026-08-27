import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { CreateExpenseDialog, EditExpenseDialog } from "@/components/expenses/expense-dialogs";
import { PayExpenseDialog } from "@/components/expenses/pay-expense-dialog";
import { IssueVoucherButton } from "@/components/expenses/issue-voucher-button";
import { deleteExpense } from "@/lib/actions/expenses";
import { CATEGORY_LABELS, BEARER_LABELS, EXPENSE_CATEGORIES, EXPENSE_BEARERS } from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/format";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { ReceiptText } from "lucide-react";

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "paid", label: "مدفوعة" },
  { key: "unpaid", label: "غير مدفوعة" },
];

export default async function ExpensesPage(props: PageProps<"/expenses">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("expenses.create");
  const params = await props.searchParams;

  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const status = params.status === "paid" || params.status === "unpaid" ? params.status : "all";
  const category = EXPENSE_CATEGORIES.some((c) => c.value === params.category) ? String(params.category) : "";
  const bearer = EXPENSE_BEARERS.some((b) => b.value === params.bearer) ? String(params.bearer) : "";
  const buildingId = typeof params.building === "string" ? params.building : "";

  const filterParams: Record<string, string> = {
    ...(status !== "all" ? { status } : {}),
    ...(category ? { category } : {}),
    ...(bearer ? { bearer } : {}),
    ...(buildingId ? { building: buildingId } : {}),
  };
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  const where = {
    building: scope,
    ...(status === "paid" ? { paidDate: { not: null } } : status === "unpaid" ? { paidDate: null } : {}),
    ...(category ? { category: category as (typeof EXPENSE_CATEGORIES)[number]["value"] } : {}),
    ...(bearer ? { bearer: bearer as (typeof EXPENSE_BEARERS)[number]["value"] } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q } },
            { vendor: { contains: q } },
            { building: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.expense.count({ where });
  const { skip, take } = paginate(total, page, size);

  const [expenses, matching, buildings, units] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        unit: { select: { unitNumber: true } },
        documents: { where: { type: "PAYMENT_VOUCHER" }, select: { id: true, documentNumber: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ expenseDate: "desc" }],
      skip,
      take,
    }),
    // Totals cover the whole filtered set, not just the page in view.
    prisma.expense.findMany({ where, select: { amount: true, paidDate: true, bearer: true } }),
    prisma.building.findMany({ where: scope, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      where: { building: scope },
      orderBy: { unitNumber: "asc" },
      select: { id: true, unitNumber: true, buildingId: true },
    }),
  ]);

  const totalAmount = matching.reduce((s, e) => s + e.amount, 0);
  const unpaidAmount = matching.filter((e) => !e.paidDate).reduce((s, e) => s + e.amount, 0);
  const ownerPaidAmount = matching
    .filter((e) => e.bearer === "OWNER" && e.paidDate)
    .reduce((s, e) => s + e.amount, 0);

  const hrefWith = (overrides: Record<string, string>) => {
    const next = { ...extraParams, ...overrides };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v)).toString();
    return `/expenses${qs ? `?${qs}` : ""}`;
  };

  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المصروفات</h1>
          <p className="text-sm text-muted-foreground">
            مصروفات المباني والوحدات — ما يتحمله المالك ويُصرف فعلاً يُخصم قبل احتساب عمولة الإدارة
          </p>
        </div>
        {canManage && <CreateExpenseDialog buildings={buildings} units={units} />}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">غير مدفوعة</p>
            <p className={cn("text-lg font-bold tabular-nums", unpaidAmount > 0 && "text-red-600")}>
              {formatCurrency(unpaidAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">مخصومة من المالك</p>
            <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(ownerPaidAmount)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={hrefWith({ status: tab.key === "all" ? "" : tab.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                status === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form action="/expenses" className="flex flex-wrap items-center gap-2">
          {Object.entries({ ...(q ? { q } : {}), ...(status !== "all" ? { status } : {}) }).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <select name="building" defaultValue={buildingId} className={selectClass}>
            <option value="">كل المباني</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={category} className={selectClass}>
            <option value="">كل التصنيفات</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select name="bearer" defaultValue={bearer} className={selectClass}>
            <option value="">كل الجهات</option>
            {EXPENSE_BEARERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <button type="submit" className="h-8 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
            تطبيق
          </button>
        </form>
      </div>

      <SearchInput
        basePath="/expenses"
        defaultValue={q}
        placeholder="بحث بالوصف أو المورّد أو المبنى..."
        extraParams={filterParams}
      />

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ReceiptText className="size-10" />
            <p>{q || Object.keys(filterParams).length > 0 ? "لا توجد نتائج مطابقة" : "لا توجد مصروفات مسجّلة بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/expenses" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المبنى / الوحدة</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>المورّد</TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                      <TableHead>جهة التحمل</TableHead>
                      <TableHead>سجّله</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManage && <TableHead className="w-24">خيارات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="tabular-nums">{formatDate(e.expenseDate)}</TableCell>
                        <TableCell>
                          <Link href={`/buildings/${e.building.id}`} className="font-medium hover:underline">
                            {e.building.name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {e.unit ? `وحدة ${e.unit.unitNumber}` : "عام على المبنى"}
                          </span>
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[e.category]}</TableCell>
                        <TableCell className="max-w-56 truncate">{e.description}</TableCell>
                        <TableCell>{e.vendor ?? "—"}</TableCell>
                        <TableCell className="text-left font-medium tabular-nums">{formatCurrency(e.amount)}</TableCell>
                        <TableCell>{BEARER_LABELS[e.bearer]}</TableCell>
                        <TableCell className="text-muted-foreground">{e.createdBy?.name ?? "—"}</TableCell>
                        <TableCell>
                          {e.paidDate ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="border-0 bg-emerald-100 font-medium text-emerald-700">
                                صُرف {formatDate(e.paidDate)}
                              </Badge>
                              {e.documents[0] && (
                                <Link
                                  href={`/documents/${e.documents[0].id}`}
                                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                  dir="ltr"
                                >
                                  {e.documents[0].documentNumber}
                                </Link>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="border-0 bg-amber-100 font-medium text-amber-700">
                              غير مدفوع
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {!e.paidDate && (
                                <PayExpenseDialog
                                  expenseId={e.id}
                                  amount={e.amount}
                                  vendor={e.vendor}
                                  expenseDate={e.expenseDate.toISOString().slice(0, 10)}
                                />
                              )}
                              {e.paidDate && !e.documents[0] && (
                                <IssueVoucherButton expenseId={e.id} />
                              )}
                              <EditExpenseDialog
                                expense={{
                                  id: e.id,
                                  buildingId: e.buildingId,
                                  unitId: e.unitId,
                                  category: e.category,
                                  description: e.description,
                                  amount: e.amount,
                                  vendor: e.vendor,
                                  expenseDate: e.expenseDate,
                                  paidDate: e.paidDate,
                                  bearer: e.bearer,
                                  fileUrl: e.fileUrl,
                                  notes: e.notes,
                                }}
                                buildings={buildings}
                                units={units}
                              />
                              <DeleteButton
                                action={deleteExpense.bind(null, e.id)}
                                permission="expenses.delete" title="حذف المصروف"
                                description="سيتم حذف المصروف نهائياً، وتتغيّر تسوية المالك تبعاً لذلك."
                              />
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

          <PaginationNav basePath="/expenses" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
