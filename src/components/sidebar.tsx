"use client";

import { useState } from "react";
import { PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/sidebar-nav";
import { BrandMark } from "@/components/brand-mark";
import { SIDEBAR_COOKIE } from "@/lib/ui-cookies";

/**
 * The wide screens in this system are its tables — statements, payments, contracts — so the
 * navigation narrows to a rail of icons and gives the room back. The choice is kept in a
 * cookie rather than local storage: the server renders the saved width, so nothing jumps on load.
 */
export function Sidebar({
  role,
  allowed,
  orgName,
  orgLogoUrl,
  defaultCollapsed,
}: {
  role: "ADMIN" | "OWNER" | "EMPLOYEE";
  allowed?: string[];
  orgName: string;
  orgLogoUrl?: string | null;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function apply(next: boolean) {
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        "hidden transition-[width] duration-200 md:flex md:flex-col md:border-l md:bg-background print:hidden",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div className={cn("flex h-[3.25rem] items-center gap-2 border-b", collapsed ? "justify-center px-2" : "px-4")}>
        {collapsed ? (
          // مع الطي يصير الشعار نفسه زرّ التوسيع، فيبقى مكان المنشأة ولا يزدحم الشريط
          <button
            type="button"
            onClick={() => apply(false)}
            aria-label="توسيع القائمة"
            className="group relative flex size-9 items-center justify-center rounded-lg hover:bg-muted"
          >
            <BrandMark name={orgName} logoUrl={orgLogoUrl} iconClassName="size-6" textClassName="sr-only" />
            <Flyout text="توسيع القائمة" />
          </button>
        ) : (
          <>
            <BrandMark name={orgName} logoUrl={orgLogoUrl} />
            <button
              type="button"
              onClick={() => apply(true)}
              aria-label="طي القائمة"
              title="طي القائمة"
              className="ms-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PanelRightClose className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* The rail is short enough not to scroll, and scrolling would clip the hover labels. */}
      <div className={cn("flex-1", collapsed ? "overflow-visible" : "overflow-y-auto")}>
        <SidebarNav role={role} allowed={allowed} collapsed={collapsed} onExpand={() => apply(false)} />
      </div>
    </aside>
  );
}

/** The label of a collapsed icon, shown beside it on hover — placed toward the content side. */
export function Flyout({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute start-full top-1/2 z-50 ms-2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
      {text}
    </span>
  );
}
