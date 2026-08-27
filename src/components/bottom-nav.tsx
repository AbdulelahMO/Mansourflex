"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, FileText, Wallet, Bell, ReceiptText } from "lucide-react";

const STAFF_ITEMS = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/buildings", label: "المباني", icon: Building2 },
  { href: "/contracts", label: "العقود", icon: FileText },
  { href: "/payments", label: "التحصيل", icon: Wallet },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
];

/** The owner's shortcuts point inside their portal; the staff pages are closed to them. */
const OWNER_ITEMS = [
  { href: "/portal", label: "بوابتي", icon: LayoutDashboard },
  { href: "/account", label: "حسابي", icon: ReceiptText },
];

export function BottomNav({ className, role }: { className?: string; role?: "ADMIN" | "OWNER" | "EMPLOYEE" }) {
  const pathname = usePathname();
  const items = role === "OWNER" ? OWNER_ITEMS : STAFF_ITEMS;

  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-background md:hidden", className)}>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
