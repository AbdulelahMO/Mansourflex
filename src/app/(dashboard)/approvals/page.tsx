import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "@/components/staff/approval-actions";
import { expireStaleApprovals, APPROVAL_WINDOW_DAYS } from "@/lib/approvals";
import { permissionLabel } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار القرار",
  APPROVED: "وُوفق عليه ونُفِّذ",
  REJECTED: "مرفوض",
  EXPIRED: "منتهي المدة",
  FAILED: "تعذّر تنفيذه",
};

const STATUS_TONES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-slate-100 text-slate-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  FAILED: "bg-red-100 text-red-700",
};

export default async function ApprovalsPage() {
  const user = await requireUser();
  await expireStaleApprovals();

  // The admin decides on everyone's requests; an employee follows their own and reads the reply.
  const isDecider = user.role === "ADMIN";

  const requests = await prisma.approvalRequest.findMany({
    where: isDecider ? {} : { requestedById: user.id },
    include: {
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">طلبات الموافقة</h1>
        <p className="text-sm text-muted-foreground">
          {isDecider
            ? `إجراءات حسّاسة طلبها موظفون ولا تُنفَّذ إلا بموافقتك — ويسقط الطلب تلقائياً بعد ${APPROVAL_WINDOW_DAYS} أيام`
            : `طلباتك المرفوعة لمدير النظام وردّه عليها — ويسقط الطلب تلقائياً بعد ${APPROVAL_WINDOW_DAYS} أيام`}
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ShieldCheck className="size-10" />
            <p>{isDecider ? "لا توجد طلبات بانتظار قرارك" : "لا توجد لك طلبات معلّقة"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <Card key={r.id} className="border-amber-200">
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      طلبه {r.requestedBy.name} · {formatDate(r.createdAt)} · الصلاحية:{" "}
                      {permissionLabel(r.action)} · يسقط في {formatDate(r.expiresAt)}
                    </p>
                  </div>
                  <Badge variant="secondary" className={cn("border-0", STATUS_TONES[r.status])}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">سبب الطلب</p>
                  <p className="mt-1 whitespace-pre-wrap">{r.reason}</p>
                </div>

                {isDecider ? (
                  <ApprovalActions id={r.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">بانتظار قرار مدير النظام — سيُنفَّذ فور الموافقة</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">طلبات سابقة بُتّ فيها ({decided.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isDecider
                ? "سجل لما وُوفق عليه ورُفض وسقط بالمدة — للرجوع إليه، ولا يقبل قراراً جديداً"
                : "ردّ مدير النظام على طلباتك السابقة"}
            </p>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {decided.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{r.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    طلبه {r.requestedBy.name} · {formatDate(r.createdAt)}
                    {r.decidedBy && ` · بتّ فيه ${r.decidedBy.name}`}
                  </p>
                  {r.decisionNote && (
                    <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">
                      <span className="text-muted-foreground">ردّ المدير: </span>
                      {r.decisionNote}
                    </p>
                  )}
                  {r.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}
                </div>
                <Badge variant="secondary" className={cn("border-0", STATUS_TONES[r.status])}>
                  {STATUS_LABELS[r.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
