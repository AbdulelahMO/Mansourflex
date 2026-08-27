"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { BarChart3 } from "lucide-react";

export type InsightItem = { id: string; name: string; sub?: string; collected: number; due: number };
export type UpcomingPaymentItem = { id: string; name: string; sub?: string; amount: number; dueDate: string };

type ViewKey = "topProperties" | "lowProperties" | "topTenants" | "topOwners" | "upcoming";

export function TopCollectionsChart({
  properties,
  tenants,
  owners,
  upcoming,
  showOwners,
}: {
  properties: InsightItem[];
  tenants: InsightItem[];
  owners: InsightItem[];
  upcoming: UpcomingPaymentItem[];
  showOwners: boolean;
}) {
  const [view, setView] = useState<ViewKey>("topProperties");
  const [showAll, setShowAll] = useState(false);

  const viewOptions: { value: ViewKey; label: string }[] = [
    { value: "topProperties", label: "أعلى العقارات تحصيلاً" },
    { value: "lowProperties", label: "أقل العقارات تحصيلاً" },
    { value: "topTenants", label: "كبار المستأجرين" },
    ...(showOwners ? [{ value: "topOwners" as ViewKey, label: "كبار الملاك" }] : []),
    { value: "upcoming", label: "الدفعات القادمة" },
  ];

  const sortedItems = useMemo(() => {
    if (view === "lowProperties") return [...properties].sort((a, b) => a.collected - b.collected);
    if (view === "topTenants") return [...tenants].sort((a, b) => b.collected - a.collected);
    if (view === "topOwners") return [...owners].sort((a, b) => b.collected - a.collected);
    if (view === "topProperties") return [...properties].sort((a, b) => b.collected - a.collected);
    return [];
  }, [view, properties, tenants, owners]);

  const sortedUpcoming = useMemo(
    () => [...upcoming].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [upcoming]
  );

  const isUpcoming = view === "upcoming";
  const items = isUpcoming ? [] : showAll ? sortedItems : sortedItems.slice(0, 5);
  const upcomingItems = isUpcoming ? (showAll ? sortedUpcoming : sortedUpcoming.slice(0, 5)) : [];

  const maxTotal = Math.max(1, ...items.map((b) => b.collected + b.due));
  const maxAmount = Math.max(1, ...upcomingItems.map((p) => p.amount));

  const isEmpty = isUpcoming ? upcomingItems.length === 0 : items.length === 0;

  return (
    <Card className="h-full gap-0 border-0 bg-[#0d3b44] py-0 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-[#8fd1a0]" />
          مؤشرات التحصيل
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-white/70 select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="size-3.5 accent-[#5cb57a]"
            />
            عرض الكل وليس أعلى النتائج فقط
          </label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ViewKey)}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none"
          >
            {viewOptions.map((o) => (
              <option key={o.value} value={o.value} className="text-black">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CardContent className="max-h-[420px] overflow-y-auto p-4">
        {isEmpty ? (
          <p className="py-14 text-center text-sm text-white/60">لا توجد بيانات لعرضها</p>
        ) : isUpcoming ? (
          <div className="space-y-4">
            {upcomingItems.map((p) => (
              <div key={p.id}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-white/90">
                    {p.name}
                    {p.sub && <span className="text-white/50"> · {p.sub}</span>}
                  </span>
                  <span className="text-white/60">
                    {formatCurrency(p.amount)} · {formatDate(p.dueDate)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-[#5cb57a]" style={{ width: `${(p.amount / maxAmount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((b) => {
              const collectedPct = (b.collected / maxTotal) * 100;
              const duePct = (b.due / maxTotal) * 100;
              return (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/90">{b.name}</span>
                    <span className="text-white/60" dir="ltr">
                      {formatCurrency(b.collected)} / {formatCurrency(b.collected + b.due)}
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10" dir="ltr">
                    <div className="h-full bg-[#5cb57a]" style={{ width: `${collectedPct}%` }} />
                    <div className="h-full bg-[#e07a5f]" style={{ width: `${duePct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <div className="flex items-center gap-4 border-t border-white/10 px-4 py-3 text-[11px] text-white/70">
        {!isUpcoming && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#5cb57a]" /> محصّل
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#e07a5f]" /> مستحق
            </span>
          </>
        )}
        <Link href="/payments" className="mr-auto text-white/60 hover:text-white">
          عرض الكل
        </Link>
      </div>
    </Card>
  );
}
