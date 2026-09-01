import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { formatDate } from "@/lib/format";
import { CircleAlert } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  EMPLOYEE: "موظف",
  OWNER: "مالك عقار",
};

export default async function AccountPage() {
  const session = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: session.id },
    include: { staffRole: { select: { name: true } } },
  });
  // A blank page is the worst answer: it says nothing, and this is the one screen that would
  // have told its owner what their account even is.
  if (!account) redirect("/session-ended");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">حسابي</h1>
        <p className="text-sm text-muted-foreground">بياناتك وكلمة مرورك</p>
      </div>

      {account.mustChangePassword && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            كلمة مرورك الحالية <span className="font-semibold">مؤقتة</span> — غيّرها الآن، فلن تتمكن من استخدام
            النظام قبل ذلك.
          </p>
        </div>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">بياناتي</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">الاسم</p>
            <p className="font-medium">{account.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الصفة</p>
            <p className="font-medium">
              {ROLE_LABELS[account.role]}
              {account.staffRole && ` — ${account.staffRole.name}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
            <p className="font-medium" dir="ltr">
              {account.email}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الجوال</p>
            <p className="font-medium" dir="ltr">
              {account.phone ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
            <p className="font-medium">{formatDate(account.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الحالة</p>
            <Badge
              variant="secondary"
              className={account.isActive ? "border-0 bg-emerald-100 text-emerald-700" : "border-0"}
            >
              {account.isActive ? "نشط" : "موقوف"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">تغيير كلمة المرور</CardTitle>
          <p className="text-xs text-muted-foreground">لا يعرف كلمة مرورك أحد سواك — ولا تُخزَّن إلا مشفّرة</p>
        </CardHeader>
        <CardContent className="py-4">
          <ChangePasswordForm forced={account.mustChangePassword} />
        </CardContent>
      </Card>
    </div>
  );
}
