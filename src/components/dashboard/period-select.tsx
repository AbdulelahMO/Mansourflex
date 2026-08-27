"use client";

import { useRouter } from "next/navigation";

/**
 * Period switch for a single figure. Rendered in place of that figure's label so the card
 * keeps its exact height and stays aligned with the cards beside it.
 */
export function PeriodSelect({
  value,
  options,
}: {
  value: string;
  options: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <select
      value={value}
      aria-label="فترة المحصّل"
      onChange={(e) => router.push(e.target.value === "year" ? "/" : `/?period=${e.target.value}`)}
      className="mx-auto block cursor-pointer rounded-md border-0 bg-transparent py-0 text-center text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
    >
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          المحصّل — {label}
        </option>
      ))}
    </select>
  );
}
