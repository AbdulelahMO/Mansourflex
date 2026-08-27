import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { permissionState } from "@/lib/authz";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { permissionLabel } from "@/lib/permissions";
import { History } from "lucide-react";

export default async function AuditLogPage(props: PageProps<"/settings/audit">) {
  const user = await requireUser();
  if ((await permissionState(user, "audit.view")) === "DENY") notFound();

  const params = await props.searchParams;
  const size = parsePageSize(params.size);
  const page = parsePage(params.page);
  const who = typeof params.who === "string" ? params.who : "";
  const extraParams: Record<string, string> = who ? { who } : {};

  const where = who ? { userId: who } : {};

  const total = await prisma.auditLog.count({ where });
  const { skip, take } = paginate(total, page, size);

  const [logs, actors] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    // Whoever actually appears in the log, so the filter never offers an empty option.
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">سجل العمليات</h1>
        <p className="text-sm text-muted-foreground">من نفّذ أي إجراء ومتى — يشمل ما نُفِّذ بموافقة على طلب</p>
      </div>

      {actors.length > 0 && (
        <form action="/settings/audit" className="flex flex-wrap items-center gap-2">
          <select
            name="who"
            defaultValue={who}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">كل المستخدمين</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">
            تصفية
          </button>
        </form>
      )}

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <History className="size-10" />
            <p>لم تُسجَّل عمليات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PaginationTopBar basePath="/settings/audit" total={total} page={page} size={size} extraParams={extraParams} />
          <Card className="py-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {l.createdAt.toLocaleString("ar-SA-u-ca-gregory", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{l.userName}</TableCell>
                        <TableCell>{permissionLabel(l.action)}</TableCell>
                        <TableCell>
                          {l.summary}
                          {l.approvalId && <span className="block text-xs text-amber-700">نُفِّذ بموافقة على طلب</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <PaginationNav basePath="/settings/audit" total={total} page={page} size={size} extraParams={extraParams} />
        </>
      )}
    </div>
  );
}
