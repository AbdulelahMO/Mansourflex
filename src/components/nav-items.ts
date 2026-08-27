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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Admins and employees alike, but never owners. */
  staffOnly?: boolean;
  /** Employees see the item only when they hold this permission. */
  permission?: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
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
  { href: "/settings/integrations", label: "الربط والتكاملات", icon: Plug, permission: "settings.integrations" },
];
