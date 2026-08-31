/**
 * The catalogue of everything a role can be granted. Keys are stable strings used by the
 * server guard, the role editor and the audit log, so a permission is defined once here.
 *
 * `sensitive` marks what a "كل شيء ما عدا" role must NOT inherit silently: adding a new
 * sensitive permission later leaves such roles without it until it is granted deliberately.
 */
export type PermissionDef = {
  key: string;
  label: string;
  sensitive?: boolean;
  /** Never delegable, whatever the role says — see ALWAYS_ADMIN_ONLY. */
  adminOnly?: boolean;
};

export type PermissionGroup = {
  module: string;
  label: string;
  permissions: PermissionDef[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: "buildings",
    label: "المباني والوحدات",
    permissions: [
      { key: "buildings.view", label: "عرض المباني" },
      { key: "buildings.create", label: "إضافة مبنى" },
      { key: "buildings.edit", label: "تعديل مبنى" },
      { key: "buildings.archive", label: "أرشفة مبنى وإعادته" },
      { key: "buildings.delete", label: "حذف مبنى وكل ما يتبعه", sensitive: true },
      { key: "units.create", label: "إضافة وحدة" },
      { key: "units.edit", label: "تعديل وحدة" },
      { key: "units.delete", label: "حذف وحدة", sensitive: true },
    ],
  },
  {
    module: "owners",
    label: "الملاك",
    permissions: [
      { key: "owners.view", label: "عرض الملاك" },
      { key: "owners.create", label: "إضافة مالك" },
      { key: "owners.edit", label: "تعديل مالك" },
      { key: "owners.delete", label: "حذف مالك", sensitive: true },
      { key: "owners.access", label: "حسابات دخول الملاك", sensitive: true, adminOnly: true },
    ],
  },
  {
    module: "agreements",
    label: "اتفاقيات الإدارة",
    permissions: [
      { key: "agreements.view", label: "عرض الاتفاقيات" },
      { key: "agreements.create", label: "إنشاء اتفاقية" },
      { key: "agreements.edit", label: "تعديل اتفاقية ونسبة العمولة", sensitive: true },
      { key: "agreements.settle", label: "تصفية اتفاقية وإنهاؤها", sensitive: true },
      { key: "agreements.cancelSettlement", label: "إلغاء التصفية", sensitive: true },
      { key: "agreements.delete", label: "حذف اتفاقية", sensitive: true },
    ],
  },
  {
    module: "tenants",
    label: "المستأجرون",
    permissions: [
      { key: "tenants.view", label: "عرض المستأجرين" },
      { key: "tenants.create", label: "إضافة مستأجر" },
      { key: "tenants.edit", label: "تعديل مستأجر" },
      { key: "tenants.delete", label: "حذف مستأجر", sensitive: true },
    ],
  },
  {
    module: "contracts",
    label: "العقود",
    permissions: [
      { key: "contracts.view", label: "عرض العقود" },
      { key: "contracts.create", label: "إنشاء عقد" },
      { key: "contracts.renew", label: "تجديد عقد" },
      { key: "contracts.edit", label: "تعديل عقد وحالته" },
      { key: "contracts.terms", label: "تعديل شروط العقد بعد التحصيل", sensitive: true },
      { key: "contracts.delete", label: "حذف عقد", sensitive: true },
    ],
  },
  {
    module: "payments",
    label: "التحصيل",
    permissions: [
      { key: "payments.view", label: "عرض التحصيل" },
      { key: "payments.pay", label: "تسجيل دفعة" },
      { key: "payments.edit", label: "تعديل دفعة" },
      { key: "payments.reverse", label: "التراجع عن تحصيل وإلغاء سنده", sensitive: true },
    ],
  },
  {
    module: "documents",
    label: "المستندات المالية",
    permissions: [
      { key: "documents.view", label: "عرض المستندات" },
      { key: "documents.issue", label: "إصدار فاتورة أو سند" },
      { key: "documents.cancel", label: "إلغاء مستند مالي", sensitive: true },
    ],
  },
  {
    module: "expenses",
    label: "المصروفات",
    permissions: [
      { key: "expenses.view", label: "عرض المصروفات" },
      { key: "expenses.create", label: "تسجيل مصروف" },
      { key: "expenses.pay", label: "سداد مصروف" },
      { key: "expenses.edit", label: "تعديل مصروف" },
      { key: "expenses.delete", label: "حذف مصروف", sensitive: true },
    ],
  },
  {
    module: "remittances",
    label: "التوريد وكشوف الملاك",
    permissions: [
      { key: "statements.view", label: "عرض كشف حساب المالك" },
      { key: "remittances.create", label: "تسجيل توريد للمالك" },

    ],
  },
  {
    module: "settings",
    label: "الإعدادات والإدارة",
    permissions: [
      { key: "settings.organization", label: "بيانات المنشأة", sensitive: true },
      { key: "settings.integrations", label: "الربط والتكاملات", sensitive: true },
      { key: "settings.reset", label: "تفريغ بيانات النظام", sensitive: true, adminOnly: true },
      { key: "audit.view", label: "عرض سجل العمليات", sensitive: true },
      { key: "account.password", label: "تغيير كلمة المرور الشخصية" },
      { key: "staff.manage", label: "إدارة الموظفين والصلاحيات", sensitive: true, adminOnly: true },
      { key: "approvals.decide", label: "البتّ في طلبات الموافقة", sensitive: true, adminOnly: true },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const BY_KEY = new Map(ALL_PERMISSIONS.map((p) => [p.key, p]));

export function permissionDef(key: string) {
  return BY_KEY.get(key);
}

export function permissionLabel(key: string) {
  return BY_KEY.get(key)?.label ?? key;
}

/**
 * Granting permissions and approving requests can never be delegated: whoever holds them
 * can hand themselves everything else, which would make every other restriction decorative.
 */
export const ALWAYS_ADMIN_ONLY = new Set(ALL_PERMISSIONS.filter((p) => p.adminOnly).map((p) => p.key));

export const STATE_LABELS: Record<string, string> = {
  ALLOW: "مسموح",
  APPROVE: "يحتاج موافقة",
  DENY: "ممنوع",
};
