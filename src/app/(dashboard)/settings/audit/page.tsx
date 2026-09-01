import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { permissionState } from "@/lib/authz";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationTopBar, PaginationNav } from "@/components/pagination/pagination-controls";
import { parsePageSize, parsePage, paginate } from "@/lib/pagination";
import { permissionLabel } from "@/lib/permissions";
import { History, ShieldAlert, Lock } from "lucide-react";
import { loginLock } from "@/lib/login-guard";
import { formatDate } from "@/lib/format";

/** Arabic counts its nouns: one, two, a few, then many. */
function attemptCount(n: number) {
  if (n === 0) return "لا محاولات";
  if (n === 1) return "محاولة واحدة";
  if (n === 2) return "محاولتان";
  if (n <= 10) return `${n} محاولات`;
  return `${n} محاولة`;
}

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

  const dayAgo = new Date(Date.now() - 86_400_000);
  const fourHoursAgo = new Date(Date.now() - 4 * 3_600_000);

  const [logs, actors, failedCount, recentFailures, suspects] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    // Whoever actually appears in the log, so the filter never offers an empty option.
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.loginAttempt.count({ where: { succeeded: false, createdAt: { gte: dayAgo } } }),
    prisma.loginAttempt.findMany({
      where: { succeeded: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, email: true, ip: true, createdAt: true },
    }),
    // Only addresses with a run of failures behind them can be locked, so the exact state is
    // worked out for those few rather than for every account in the system.
    prisma.loginAttempt.groupBy({
      by: ["email"],
      where: { succeeded: false, createdAt: { gte: fourHoursAgo } },
      _count: { email: true },
      having: { email: { _count: { gte: 5 } } },
    }),
  ]);

  const locked = (
    await Promise.all(
      suspects.map(async (s) => ({ email: s.email, lock: await loginLock(s.email, null) }))
    )
  ).filter((s) => s.lock.locked);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">سجل العمليات</h1>
        <p className="text-sm text-muted-foreground">من نفّذ أي إجراء ومتى — يشمل ما نُفِّذ بموافقة على طلب</p>
      </div>

      {/* Whoever is trying passwords leaves the same trace whether they succeed or not, and it is
          the failures that say you are being worked on. */}
      <Card className="py-0">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="size-4" />
              محاولات دخول فاشلة
            </p>
            <p className="text-sm text-muted-foreground">{attemptCount(failedCount)} خلال 24 ساعة</p>
          </div>

          {locked.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {locked.map((l) => (
                <p key={l.email} className="flex items-center gap-2">
                  <Lock className="size-3.5 shrink-0" />
                  <span dir="ltr">{l.email}</span>
                  <span>— مقفل، يُفتح بعد {l.lock.minutesLeft} دقيقة</span>
                </p>
              ))}
            </div>
          )}

          {recentFailures.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد محاولات فاشلة مسجّلة</p>
          ) : (
            <div className="space-y-1">
              {recentFailures.map((f) => (
                <p key={f.id} className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span dir="ltr" className="font-medium text-foreground">
                    {f.email}
                  </span>
                  <span dir="ltr">{f.ip ?? "—"}</span>
                  <span>
                    {formatDate(f.createdAt)} ·{" "}
                    {f.createdAt.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
