"use client";

import { useEffect, useState, useTransition } from "react";
import { setUserPermission } from "@/lib/actions/staff";
import { PERMISSION_GROUPS, ALWAYS_ADMIN_ONLY, STATE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = {
  key: string;
  label: string;
  sensitive?: boolean;
  /** What the role alone would give. */
  fromRole: string;
  /** The individual exception, when one is set. */
  override: string | null;
};

const TONES: Record<string, string> = {
  ALLOW: "bg-emerald-600 text-white",
  APPROVE: "bg-amber-500 text-white",
  DENY: "bg-red-600 text-white",
};

/**
 * Per-employee exceptions layered over the role. Each row shows what the role grants, what
 * the exception changes it to, and the effective result — so nobody has to work it out.
 */
export function UserExceptions({ userId, rows }: { userId: string; rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

  useEffect(() => {
    if (result?.error) toast.error(result.error);
    if (result?.message) toast.success(result.message);
  }, [result]);

  function apply(key: string, state: string | null) {
    setBusyKey(key);
    startTransition(async () => {
      setResult(await setUserPermission(userId, key, state));
      setBusyKey(null);
    });
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.module} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">{group.label}</div>
          <div className="divide-y">
            {group.permissions
              .filter((p) => !ALWAYS_ADMIN_ONLY.has(p.key))
              .map((p) => {
                const row = byKey.get(p.key);
                if (!row) return null;
                const effective = row.override ?? row.fromRole;

                return (
                  <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm">
                        {p.label}
                        {p.sensitive && <span className="me-1.5 text-xs text-amber-700"> · حسّاسة</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        من الدور: {STATE_LABELS[row.fromRole]}
                        {row.override && <span className="text-amber-700"> · استثناء: {STATE_LABELS[row.override]}</span>}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-md px-2 py-1 text-xs font-medium", TONES[effective])}>
                        {STATE_LABELS[effective]}
                      </span>
                      <div className="flex overflow-hidden rounded-lg border">
                        {(["ALLOW", "APPROVE", "DENY"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={pending && busyKey === p.key}
                            onClick={() => apply(p.key, s)}
                            className={cn(
                              "px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50",
                              row.override === s && "bg-muted font-semibold"
                            )}
                          >
                            {STATE_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!row.override || (pending && busyKey === p.key)}
                        onClick={() => apply(p.key, null)}
                        className="rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                        title="إلغاء الاستثناء والعودة لصلاحية الدور"
                      >
                        إعادة للدور
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
