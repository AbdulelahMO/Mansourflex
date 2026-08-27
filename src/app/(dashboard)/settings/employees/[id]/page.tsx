import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { UserExceptions } from "@/components/staff/user-exceptions";
import { ALL_PERMISSIONS, ALWAYS_ADMIN_ONLY, permissionDef } from "@/lib/permissions";

export default async function EmployeePermissionsPage(props: PageProps<"/settings/employees/[id]">) {
  const { id } = await props.params;
  await requireAdmin();

  const employee = await prisma.user.findUnique({
    where: { id },
    include: {
      permissions: true,
      staffRole: { include: { permissions: true } },
    },
  });
  if (!employee || employee.role !== "EMPLOYEE") notFound();

  const role = employee.staffRole;
  const roleStates = new Map(role?.permissions.map((p) => [p.key, p.state as string]) ?? []);
  const overrides = new Map(employee.permissions.map((p) => [p.key, p.state as string]));

  const rows = ALL_PERMISSIONS.filter((p) => !ALWAYS_ADMIN_ONLY.has(p.key)).map((p) => ({
    key: p.key,
    label: p.label,
    sensitive: p.sensitive,
    // Same resolution the server guard uses, so the screen never disagrees with reality.
    fromRole:
      roleStates.get(p.key) ?? (role?.inheritsAll && !permissionDef(p.key)?.sensitive ? "ALLOW" : "DENY"),
    override: overrides.get(p.key) ?? null,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/settings/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-4" />
        العودة للموظفين
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{employee.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span dir="ltr">{employee.email}</span> · الدور: {role?.name ?? "بلا دور"}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={employee.isActive ? "border-0 bg-emerald-100 text-emerald-700" : "border-0"}
        >
          {employee.isActive ? "نشط" : "موقوف"}
        </Badge>
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          الاستثناء يخصّ هذا الموظف وحده ويعلو على دوره. استخدمه نادراً — إن احتجت الاستثناء نفسه لأكثر من موظف
          فالأنسب إنشاء دور جديد بدلاً منه.
        </p>
      </div>

      <UserExceptions userId={employee.id} rows={rows} />
    </div>
  );
}
