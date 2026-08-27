"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/nav-items";

/** The owner portal keeps its original, read-only set of pages. */
const OWNER_VISIBLE = new Set(["/buildings", "/units", "/tenants", "/contracts", "/payments", "/expenses", "/documents"]);

export function SidebarNav({
  role,
  allowed,
  onNavigate,
}: {
  role: "ADMIN" | "OWNER" | "EMPLOYEE";
  /** Permission keys the signed-in user holds; ignored for admins. */
  allowed?: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems
        .filter((item) => {
          if (role === "ADMIN") return true;
          if (item.adminOnly) return false;
          if (role === "OWNER") return !item.staffOnly && (!item.permission || OWNER_VISIBLE.has(item.href));
          return !item.permission || (allowed ?? []).includes(item.permission);
        })
        .map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
