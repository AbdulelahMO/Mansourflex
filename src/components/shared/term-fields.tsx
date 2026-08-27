"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { endDateFromTerm, termFromEndDate } from "@/lib/payment-schedule";

/** Parses a date input's value as a plain calendar date, matching how the server reads it. */
function parseDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Start date, term, and end date kept in step: typing a term fills the end date, and typing
 * an end date shows the term it works out to. The last day is inside the term — a one-year
 * contract starting 15 Jan 2026 ends 14 Jan 2027, as Ejar states it.
 */
export function TermFields({
  startName = "startDate",
  endName = "endDate",
  startLabel = "تاريخ البداية",
  endLabel = "تاريخ النهاية",
  defaultStart = "",
  defaultEnd = "",
  defaultYears = 1,
  onChange,
}: {
  startName?: string;
  endName?: string;
  startLabel?: string;
  endLabel?: string;
  defaultStart?: string;
  defaultEnd?: string;
  /** Most leases run a year, so that is what a fresh form offers. */
  defaultYears?: number;
  onChange?: (value: { startDate: string; endDate: string }) => void;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [years, setYears] = useState(defaultEnd ? "" : String(defaultYears));
  const [months, setMonths] = useState("");
  const [days, setDays] = useState("");

  function announce(nextStart: string, nextEnd: string) {
    onChange?.({ startDate: nextStart, endDate: nextEnd });
  }

  /** Term drives the end date. */
  function applyTerm(nextStart: string, y: string, m: string, d: string) {
    const from = parseDate(nextStart);
    const total = Number(y || 0) * 12 + Number(m || 0);
    const extraDays = Number(d || 0);
    if (!from || (total === 0 && extraDays === 0)) return;

    const computed = toInput(endDateFromTerm(from, Number(y || 0), Number(m || 0), extraDays));
    setEnd(computed);
    announce(nextStart, computed);
  }

  /** An end date typed by hand wins, and the term is shown for confirmation. */
  function applyEnd(value: string) {
    setEnd(value);
    const from = parseDate(start);
    const to = parseDate(value);
    if (from && to && to > from) {
      const term = termFromEndDate(from, to);
      setYears(term.years ? String(term.years) : "");
      setMonths(term.months ? String(term.months) : "");
      setDays(term.days ? String(term.days) : "");
    }
    announce(start, value);
  }

  const numberClass = "text-center";

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={startName}>
          {startLabel} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={startName}
          name={startName}
          type="date"
          required
          defaultValue={defaultStart}
          onChange={(e) => {
            setStart(e.target.value);
            applyTerm(e.target.value, years, months, days);
            announce(e.target.value, end);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>مدة العقد</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["سنوات", years, setYears, "y"],
              ["شهور", months, setMonths, "m"],
              ["أيام", days, setDays, "d"],
            ] as const
          ).map(([label, value, setValue, key]) => (
            <div key={key} className="space-y-1">
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={value}
                aria-label={label}
                className={numberClass}
                onChange={(e) => {
                  const next = e.target.value;
                  setValue(next);
                  applyTerm(
                    start,
                    key === "y" ? next : years,
                    key === "m" ? next : months,
                    key === "d" ? next : days
                  );
                }}
              />
              <p className="text-center text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          اكتب المدة فيُحسب تاريخ النهاية — واليوم الأخير داخل المدة، كما في منصة إيجار.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={endName}>
          {endLabel} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={endName}
          name={endName}
          type="date"
          required
          value={end}
          min={start || undefined}
          onChange={(e) => applyEnd(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">يمكنك تعديله يدوياً، وتُحدَّث المدة أعلاه تبعاً له.</p>
      </div>
    </>
  );
}
