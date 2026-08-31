import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  UserRound,
  FileText,
  Wallet,
  Bell,
  Plug,
  Building,
  Handshake,
  ReceiptText,
  FileSpreadsheet,
  ShieldCheck,
  UsersRound,
  History,
  Home,
  Landmark,
  Wallet2,
  Settings,
  DatabaseBackup,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Admins and employees alike, but never owners. */
  staffOnly?: boolean;
  /** The owner portal's own entry — hidden from staff. */
  ownerOnly?: boolean;
  /** Employees see the item only when they hold this permission. */
  permission?: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/portal", label: "بوابتي", icon: LayoutDashboard, ownerOnly: true },
  { href: "/buildings", label: "المباني", icon: Building2, permission: "buildings.view" },
  { href: "/units", label: "الوحدات", icon: DoorOpen, permission: "buildings.view" },
  { href: "/owners", label: "الملاك", icon: Users, permission: "owners.view" },
  { href: "/agreements", label: "اتفاقيات الإدارة", icon: Handshake, permission: "agreements.view" },
  { href: "/tenants", label: "المستأجرين", icon: UserRound, permission: "tenants.view" },
  { href: "/contracts", label: "العقود", icon: FileText, permission: "contracts.view" },
  { href: "/payments", label: "التحصيل", icon: Wallet, permission: "payments.view" },
  { href: "/expenses", label: "المصروفات", icon: ReceiptText, permission: "expenses.view" },
  { href: "/documents", label: "المستندات المالية", icon: FileSpreadsheet, permission: "documents.view" },
  { href: "/approvals", label: "طلبات الموافقة", icon: ShieldCheck, staffOnly: true },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/settings/employees", label: "الموظفون والصلاحيات", icon: UsersRound, adminOnly: true },
  { href: "/settings/audit", label: "سجل العمليات", icon: History, permission: "audit.view" },
  { href: "/settings/organization", label: "بيانات المنشأة", icon: Building, permission: "settings.organization" },
  { href: "/settings/import", label: "استيراد البيانات", icon: Upload, permission: "contracts.create" },
  { href: "/settings/data", label: "البيانات والنسخ", icon: DatabaseBackup, permission: "settings.organization" },
  { href: "/settings/integrations", label: "الربط والتكاملات", icon: Plug, permission: "settings.integrations" },
];

/**
 * The sidebar is grouped so it stays short as the system grows: a section opens on demand,
 * and the one holding the current page opens by itself. Items keep their own permission, so
 * a section with nothing the user may see disappears entirely.
 */
export type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type NavEntry = { type: "item"; item: NavItem } | { type: "group"; group: NavGroup };

const byHref = new Map(navItems.map((i) => [i.href, i]));
const item = (href: string) => byHref.get(href)!;

export const navEntries: NavEntry[] = [
  { type: "item", item: item("/") },
  {
    type: "group",
    group: {
      key: "properties",
      label: "العقارات",
      icon: Landmark,
      items: [item("/buildings"), item("/units")],
    },
  },
  {
    type: "group",
    group: {
      key: "owners",
      label: "الملاك",
      icon: Users,
      items: [item("/owners"), item("/agreements")],
    },
  },
  {
    type: "group",
    group: {
      key: "leasing",
      label: "الإيجارات",
      icon: Home,
      items: [item("/tenants"), item("/contracts")],
    },
  },
  {
    type: "group",
    group: {
      key: "finance",
      label: "المالية",
      icon: Wallet2,
      items: [item("/payments"), item("/expenses"), item("/documents")],
    },
  },
  { type: "item", item: item("/notifications") },
  {
    type: "group",
    group: {
      key: "admin",
      label: "الإدارة",
      icon: Settings,
      items: [
        item("/approvals"),
        item("/settings/employees"),
        item("/settings/audit"),
        item("/settings/organization"),
        item("/settings/import"),
        item("/settings/data"),
        item("/settings/integrations"),
      ],
    },
  },
];
