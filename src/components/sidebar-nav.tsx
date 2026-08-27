"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { navEntries, type NavItem } from "@/components/nav-items";
import { ChevronDown } from "lucide-react";

/** Everything the owner needs now lives in the portal, so the staff pages are not theirs. */
const OWNER_VISIBLE = new Set(["/portal"]);

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
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const visible = (item: NavItem) => {
    if (item.ownerOnly) return role === "OWNER";
    if (role === "ADMIN") return true;
    if (item.adminOnly) return false;
    if (role === "OWNER") return !item.staffOnly && OWNER_VISIBLE.has(item.href);
    return !item.permission || (allowed ?? []).includes(item.permission);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  function Row({ item, nested }: { item: NavItem; nested?: boolean }) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          nested && "ps-9 py-2",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className={cn("shrink-0", nested ? "size-4" : "size-5")} />
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navEntries.map((entry) => {
        if (entry.type === "item") {
          return visible(entry.item) ? <Row key={entry.item.href} item={entry.item} /> : null;
        }

        const { key, label, icon: Icon, items } = entry.group;
        const shown = items.filter(visible);
        // A section with nothing the user may open is not a section for them.
        if (shown.length === 0) return null;

        const holdsCurrent = shown.some((i) => isActive(i.href));
        // The section containing the current page opens by itself, until it is toggled.
        const open = opened[key] ?? holdsCurrent;

        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => setOpened((prev) => ({ ...prev, [key]: !open }))}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                holdsCurrent && !open
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1 text-start">{label}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="mt-1 flex flex-col gap-1">
                {shown.map((i) => (
                  <Row key={i.href} item={i} nested />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
