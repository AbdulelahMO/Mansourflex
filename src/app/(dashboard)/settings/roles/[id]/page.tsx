import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { PermissionMatrix } from "@/components/staff/permission-matrix";
import { saveRolePermissions } from "@/lib/actions/staff";

export default async function RolePermissionsPage(props: PageProps<"/settings/roles/[id]">) {
  const { id } = await props.params;
  await requireAdmin();

  const role = await prisma.staffRole.findUnique({
    where: { id },
    include: { permissions: true, _count: { select: { users: true } } },
  });
  if (!role) notFound();

  const current = Object.fromEntries(role.permissions.map((p) => [p.key, p.state]));

  return (
    <div className="space-y-4">
      <Link
        href="/settings/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-4" />
        العودة للموظفين
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{role.name}</h1>
          {role.inheritsAll && (
            <Badge variant="secondary" className="border-0 bg-sky-100 text-sky-700">
              كل شيء ما عدا المستثنى
            </Badge>
          )}
          {role.isSystem && (
            <Badge variant="secondary" className="border-0">
              دور معرّف مع النظام
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {role.description ?? "صلاحيات هذا الدور"} · مسند إلى {role._count.users} موظف — أي تعديل هنا يسري عليهم
          جميعاً
        </p>
      </div>

      <PermissionMatrix
        action={saveRolePermissions.bind(null, role.id)}
        current={current}
        inheritsAll={role.inheritsAll}
      />
    </div>
  );
}
