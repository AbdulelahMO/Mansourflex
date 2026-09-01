/**
 * The roles the system ships with, and what each may do.
 *
 * They live here rather than only in the database so a fresh install comes up with a working
 * permission model, and so a change to who may do what is reviewable in the history like any
 * other change. Applying them never overwrites a state already stored: an administrator who
 * tunes a role from the settings screen keeps that tuning, and only keys the role has no row
 * for are filled in — which is also how a newly added sensitive permission reaches the roles
 * that should hold it instead of being denied in silence.
 */
export type PermissionState = "ALLOW" | "APPROVE" | "DENY";

export type SystemRole = {
  name: string;
  description: string;
  /** Holds every permission not listed — except the sensitive ones, which must be granted by name. */
  inheritsAll: boolean;
  permissions: Record<string, PermissionState>;
};

export const SYSTEM_ROLES: SystemRole[] = [
  {
    name: "نائب المدير",
    description: "كل الصلاحيات، والإجراءات الحسّاسة تُرفع كطلب موافقة للمدير",
    inheritsAll: true,
    permissions: {
      "agreements.cancelSettlement": "APPROVE",
      "agreements.delete": "APPROVE",
      "agreements.edit": "APPROVE",
      "agreements.settle": "APPROVE",
      "audit.view": "ALLOW",
      "buildings.delete": "APPROVE",
      "contracts.delete": "APPROVE",
      "contracts.terms": "APPROVE",
      "documents.cancel": "APPROVE",
      "expenses.delete": "APPROVE",
      "owners.delete": "APPROVE",
      "payments.reverse": "APPROVE",
      "settings.integrations": "DENY",
      "settings.organization": "DENY",
      "tenants.delete": "APPROVE",
      "units.delete": "APPROVE",
    },
  },
  {
    name: "محاسب",
    description: "التحصيل والمصروفات والسندات وكشوف الملاك",
    inheritsAll: false,
    permissions: {
      "agreements.view": "ALLOW",
      "buildings.view": "ALLOW",
      "contracts.view": "ALLOW",
      "documents.issue": "ALLOW",
      "documents.view": "ALLOW",
      "expenses.create": "ALLOW",
      "expenses.edit": "ALLOW",
      "expenses.pay": "ALLOW",
      "expenses.view": "ALLOW",
      "owners.view": "ALLOW",
      "payments.edit": "ALLOW",
      "payments.pay": "ALLOW",
      "payments.view": "ALLOW",
      "remittances.create": "ALLOW",
      "statements.tenant": "ALLOW",
      "statements.view": "ALLOW",
      "tenants.view": "ALLOW",
    },
  },
  {
    name: "موظف تحصيل",
    description: "متابعة الدفعات وإصدار الفواتير وسندات القبض",
    inheritsAll: false,
    permissions: {
      "buildings.view": "ALLOW",
      "contracts.view": "ALLOW",
      "documents.issue": "ALLOW",
      "documents.view": "ALLOW",
      "payments.pay": "ALLOW",
      "payments.view": "ALLOW",
      "statements.tenant": "ALLOW",
      "tenants.create": "ALLOW",
      "tenants.edit": "ALLOW",
      "tenants.view": "ALLOW",
    },
  },
  {
    name: "مشرف صيانة",
    description: "تسجيل المصروفات ومتابعة حالة الوحدات",
    inheritsAll: false,
    permissions: {
      "buildings.view": "ALLOW",
      "expenses.create": "ALLOW",
      "expenses.edit": "ALLOW",
      "expenses.view": "ALLOW",
      "units.edit": "ALLOW",
    },
  },
];

/** The client shape needed to apply the roles — the seed's own client, or the app's. */
type RoleWriter = {
  staffRole: {
    upsert: (args: unknown) => Promise<{ id: string }>;
    findUnique: (args: unknown) => Promise<{ id: string; permissions: { key: string }[] } | null>;
  };
  rolePermission: { createMany: (args: unknown) => Promise<unknown> };
};

/**
 * Creates the shipped roles, or fills in what a stored one is missing. Returns what it added,
 * so a run that changes nothing says so instead of looking like it worked.
 */
export async function applySystemRoles(db: RoleWriter) {
  const applied: { role: string; created: boolean; added: string[] }[] = [];

  for (const role of SYSTEM_ROLES) {
    const before = await db.staffRole.findUnique({
      where: { name: role.name },
      include: { permissions: { select: { key: true } } },
    });

    const saved = await db.staffRole.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        description: role.description,
        inheritsAll: role.inheritsAll,
        isSystem: true,
      },
      // The description and the catch-all rule are the role's definition, not a setting.
      update: { description: role.description, inheritsAll: role.inheritsAll, isSystem: true },
    });

    const held = new Set(before?.permissions.map((p) => p.key) ?? []);
    const missing = Object.entries(role.permissions).filter(([key]) => !held.has(key));

    if (missing.length > 0) {
      await db.rolePermission.createMany({
        data: missing.map(([key, state]) => ({ roleId: saved.id, key, state })),
      });
    }

    applied.push({ role: role.name, created: !before, added: missing.map(([key]) => key) });
  }

  return applied;
}
