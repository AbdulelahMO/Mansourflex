import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { SearchInput } from "@/components/search/search-input";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

const TYPE_TABS = [
  { key: "all", label: "الكل" },
  { key: "INVOICE", label: "الفواتير" },
  { key: "RECEIPT", label: "سندات القبض" },
  { key: "PAYMENT_VOUCHER", label: "سندات الصرف" },
  { key: "OWNER_REMITTANCE", label: "سندات التوريد" },
];

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "فاتورة",
  RECEIPT: "سند قبض",
  PAYMENT_VOUCHER: "سند صرف",
  OWNER_REMITTANCE: "سند توريد",
};

const TYPE_TONES: Record<string, string> = {
  INVOICE: "bg-sky-100 text-sky-700",
  RECEIPT: "bg-emerald-100 text-emerald-700",
  PAYMENT_VOUCHER: "bg-amber-100 text-amber-700",
  OWNER_REMITTANCE: "bg-violet-100 text-violet-700",
};

export default async function FinancialDocumentsPage(props: PageProps<"/documents">) {
  const user = await requireUser();
  const scope = buildingScope(user);
  const params = await props.searchParams;

  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const type = TYPE_TABS.some((t) => t.key === params.type && t.key !== "all") ? String(params.type) : "all";

  const filterParams: Record<string, string> = { ...(type !== "all" ? { type } : {}) };
  const extraParams: Record<string, string> = { ...filterParams, ...(q ? { q } : {}) };

  // A document belongs either to a rent payment or to an expense; both are scoped by building.
  const where = {
    OR: [
      { contract: { unit: { building: scope } } },
      { expense: { building: scope } },
      { remittance: { building: scope } },
    ],
    ...(type !== "all" ? { type: type as "INVOICE" | "RECEIPT" | "PAYMENT_VOUCHER" | "OWNER_REMITTANCE" } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { documentNumber: { contains: q } },
                { contract: { contractNumber: { contains: q } } },
                { contract: { tenant: { name: { contains: q } } } },
                { expense: { description: { contains: q } } },
                { expense: { vendor: { contains: q } } },
                { expense: { building: { name: { contains: q } } } },
                { remittance: { owner: { name: { contains: q } } } },
                { remittance: { building: { name: { contains: q } } } },
              ],
            },
          ],
        }
      : {}),
  };

  const total = await prisma.financialDocument.count({ where });
  const { skip, take } = paginate(total, page, size);

  const [documents, matching] = await Promise.all([
    prisma.financialDocument.findMany({
      where,
      include: {
        contract: { select: { id: true, contractNumber: true, tenant: { select: { name: true } } } },
        expense: { select: { description: true, vendor: true, building: { select: { name: true } } } },
        remittance: { select: { owner: { select: { name: true } }, building: { select: { name: true } } } },
        issuedBy: { select: { name: true } },
      },
      orderBy: [{ issueDate: "desc" }, { documentNumber: "desc" }],
      skip,
      take,
    }),
    // Totals cover the whole filtered set, not just the page in view.
    prisma.financialDocument.findMany({ where, select: { amount: true, type: true, status: true } }),
  ]);

  // A cancelled document keeps its number in the list but counts for nothing.
  const sumOf = (t: string) =>
    matching.filter((d) => d.type === t && d.status !== "CANCELLED").reduce((s, d) => s + d.amount, 0);
  const cancelledCount = matching.filter((d) => d.status === "CANCELLED").length;
  const collected = sumOf("RECEIPT");
  const disbursed = sumOf("PAYMENT_VOUCHER");
  const remitted = sumOf("OWNER_REMITTANCE");

  const hrefWith = (overrides: Record<string, string>) => {
    const next = { ...extraParams, ...overrides };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v)).toString();
    return `/documents${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">المستندات المالية</h1>
        <p className="text-sm text-muted-foreground">
          الفواتير وسندات القبض على الإيجارات، وسندات الصرف على المصروفات، وسندات التوريد للملاك
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">عدد المستندات</p>
            <p className="text-lg font-bold tabular-nums">{total}</p>
            {cancelledCount > 0 && (
              <p className="text-xs text-muted-foreground">منها {cancelledCount} ملغى</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">مقبوض بسندات قبض</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(collected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">مصروف بسندات صرف</p>
            <p className="text-lg font-bold tabular-nums text-amber-700">{formatCurrency(disbursed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">مورَّد للملاك</p>
            <p className="text-lg font-bold tabular-nums text-violet-700">{formatCurrency(remitted)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={hrefWith({ type: tab.key === "all" ? "" : tab.key })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              type === tab.key ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <SearchInput
        basePath="/documents"
        defaultValue={q}
        placeholder="بحث برقم المستند أو العقد أو المستأجر أو المورّد أو المالك..."
        extraParams={filterParams}
      />

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <FileText className="size-10" />
            <p>{q || type !== "all" ? "لا توجد نتائج مطابقة" : "لم تُصدر مستندات بعد"}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/documents" total={total} page={page} size={size} extraParams={extraParams} />

          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم المستند</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                      <TableHead>أصدره</TableHead>
                      <TableHead>خيارات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium" dir="ltr">
                          <span className={cn(d.status === "CANCELLED" && "text-muted-foreground line-through")}>
                            {d.documentNumber}
                          </span>
                          {d.status === "CANCELLED" && (
                            <span className="ms-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              ملغى
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("border-0 font-medium", TYPE_TONES[d.type])}>
                            {TYPE_LABELS[d.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(d.issueDate)}</TableCell>
                        <TableCell>
                          {d.remittance ? (
                            <>
                              <span className="font-medium">توريد للمالك {d.remittance.owner.name}</span>
                              <span className="block text-xs text-muted-foreground">{d.remittance.building.name}</span>
                            </>
                          ) : d.expense ? (
                            <>
                              <span className="font-medium">{d.expense.description}</span>
                              <span className="block text-xs text-muted-foreground">
                                {d.expense.building.name}
                                {d.expense.vendor ? ` — ${d.expense.vendor}` : ""}
                              </span>
                            </>
                          ) : d.contract ? (
                            <>
                              <span className="font-medium">{d.contract.tenant.name}</span>
                              <span className="block text-xs text-muted-foreground" dir="ltr">
                                {d.contract.contractNumber}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-left tabular-nums",
                            d.status === "CANCELLED" && "text-muted-foreground line-through"
                          )}
                        >
                          {formatCurrency(d.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{d.issuedBy?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Link
                            href={`/documents/${d.id}`}
                            className="text-sm underline underline-offset-4 hover:no-underline"
                          >
                            عرض
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PaginationNav basePath="/documents" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
