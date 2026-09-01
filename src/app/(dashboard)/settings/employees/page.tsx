import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AdminDialog } from "@/components/staff/admin-dialog";
import { AdminActiveButton } from "@/components/staff/admin-active-button";
import { resetAdminPassword } from "@/lib/actions/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { EmployeeDialog, RoleDialog } from "@/components/staff/staff-dialogs";
import { ResetPasswordButton } from "@/components/staff/reset-password-button";
import { deleteEmployee, deleteRole } from "@/lib/actions/staff";
import { formatDate } from "@/lib/format";
import { UsersRound, ShieldCheck, ShieldAlert } from "lucide-react";

export default async function EmployeesPage() {
  const viewer = await requireAdmin();

  const [admins, employees, roles] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: { staffRole: { select: { id: true, name: true } }, _count: { select: { permissions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.staffRole.findMany({
      include: { _count: { select: { users: true, permissions: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
  ]);

  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الموظفون والصلاحيات</h1>
        <p className="text-sm text-muted-foreground">
          كل موظف يحمل دوراً، والدور يحمل الصلاحيات — ويمكن منح موظف بعينه استثناءً فوق دوره
        </p>
      </div>

      {/* Administrators were the one kind of account the system could not show, let alone make:
          creating or closing one meant a command on the server. An owner should never need the
          server to manage who owns the system. */}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <ShieldAlert className="size-4" />
            المديرون ({admins.length})
          </CardTitle>
          <AdminDialog />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-24">خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name}
                      {a.id === viewer.id && (
                        <span className="ms-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          أنت
                        </span>
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {a.email}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {a.phone ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(a.createdAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={a.isActive ? "border-0 bg-emerald-100 text-emerald-700" : "border-0"}
                      >
                        {a.isActive ? "نشط" : "موقوف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.id === viewer.id ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href="/account">حسابي</Link>
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <ResetPasswordButton
                            employeeId={a.id}
                            name={a.name}
                            subject="المدير"
                            action={resetAdminPassword.bind(null, a.id)}
                          />
                          <AdminActiveButton id={a.id} name={a.name} isActive={a.isActive} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {admins.filter((a) => a.isActive).length < 2 && (
            <p className="border-t bg-amber-50 px-4 py-3 text-xs text-amber-900">
              لا يوجد إلا مدير واحد نشط. أضف ثانياً ليعيد أحدهما تعيين كلمة مرور الآخر عند نسيانها — وإلا
              فالطريق الوحيد أمرٌ يُشغَّل على الخادم.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <UsersRound className="size-4" />
            الموظفون ({employees.length})
          </CardTitle>
          <EmployeeDialog roles={roleOptions} />
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">لم يُضف موظفون بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>رقم الهوية</TableHead>
                    <TableHead>الجوال</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>أُضيف في</TableHead>
                    <TableHead>خيارات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        <Link href={`/settings/employees/${e.id}`} className="hover:underline">
                          {e.name}
                        </Link>
                        {e._count.permissions > 0 && (
                          <span className="block text-xs text-amber-700">
                            {e._count.permissions} استثناء فوق الدور
                          </span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr">{e.nationalId ?? "—"}</TableCell>
                      <TableCell dir="ltr">{e.phone ?? "—"}</TableCell>
                      <TableCell dir="ltr">{e.email}</TableCell>
                      <TableCell>{e.staffRole?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            e.isActive ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-slate-100 text-slate-700"
                          }
                        >
                          {e.isActive ? "نشط" : "موقوف"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(e.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/settings/employees/${e.id}`}>الصلاحيات</Link>
                          </Button>
                          <EmployeeDialog roles={roleOptions} employee={e} />
                          <ResetPasswordButton employeeId={e.id} name={e.name} />
                          <DeleteButton
                            action={deleteEmployee.bind(null, e.id)}
                            title="حذف الموظف"
                            description="سيُحذف حساب الموظف نهائياً ولن يتمكن من الدخول. سجل عملياته يبقى محفوظاً."
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <ShieldCheck className="size-4" />
            الأدوار ({roles.length})
          </CardTitle>
          <RoleDialog />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدور</TableHead>
                  <TableHead>الموظفون</TableHead>
                  <TableHead>الصلاحيات المحدّدة</TableHead>
                  <TableHead>خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/settings/roles/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                      {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
                      {r.inheritsAll && (
                        <Badge variant="secondary" className="mt-1 border-0 bg-sky-100 text-xs text-sky-700">
                          كل شيء ما عدا المستثنى
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{r._count.users}</TableCell>
                    <TableCell className="tabular-nums">{r._count.permissions}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/settings/roles/${r.id}`}>تعديل الصلاحيات</Link>
                        </Button>
                        <RoleDialog role={r} />
                        <DeleteButton
                          action={deleteRole.bind(null, r.id)}
                          title="حذف الدور"
                          description="لا يمكن حذف دور مسند إلى موظفين أو دور معرّف مع النظام."
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
