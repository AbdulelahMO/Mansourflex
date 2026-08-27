"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pending approvals live one click away in the top bar: for the admin these are requests
 * awaiting a decision, and for an employee they are their own requests still waiting.
 */
export function ApprovalsIndicator({ count, isDecider }: { count: number; isDecider: boolean }) {
  const label = isDecider
    ? count > 0
      ? `${count} طلب بانتظار قرارك`
      : "لا توجد طلبات بانتظار قرارك"
    : count > 0
      ? `${count} من طلباتك بانتظار قرار المدير`
      : "لا توجد لك طلبات معلّقة";

  return (
    <Link
      href="/approvals"
      title={label}
      aria-label={label}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-lg transition-colors",
        count > 0 ? "text-amber-700 hover:bg-amber-50" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <ShieldCheck className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 start-0 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
