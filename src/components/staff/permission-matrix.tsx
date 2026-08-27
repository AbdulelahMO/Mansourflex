"use client";

import { useActionState, useEffect } from "react";
import { SubmitButton } from "@/components/submit-button";
import { PERMISSION_GROUPS, ALWAYS_ADMIN_ONLY, STATE_LABELS } from "@/lib/permissions";
import { initialActionState, type ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATES = ["ALLOW", "APPROVE", "DENY"] as const;

const TONES: Record<string, string> = {
  ALLOW: "peer-checked:bg-emerald-600 peer-checked:text-white",
  APPROVE: "peer-checked:bg-amber-500 peer-checked:text-white",
  DENY: "peer-checked:bg-red-600 peer-checked:text-white",
};

/**
 * Tri-state permission editor: every permission is allowed outright, gated behind an
 * approval request, or blocked. Grouped by module so the whole role reads at a glance.
 */
export function PermissionMatrix({
  action,
  current,
  inheritsAll,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Stored state per key; a missing key falls back to the role's inheritance rule. */
  current: Record<string, string>;
  inheritsAll: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.module} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">{group.label}</div>
          <div className="divide-y">
            {group.permissions.map((p) => {
              const locked = ALWAYS_ADMIN_ONLY.has(p.key);
              // Unset on a catch-all role means inherited — unless the permission is sensitive.
              const fallback = inheritsAll && !p.sensitive ? "ALLOW" : "DENY";
              const value = current[p.key] ?? fallback;

              return (
                <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {p.label}
                      {p.sensitive && <span className="me-1.5 text-xs text-amber-700"> · حسّاسة</span>}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {p.key}
                    </p>
                  </div>

                  {locked ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      لمدير النظام فقط — لا تُمنح
                    </span>
                  ) : (
                    <div className="flex shrink-0 overflow-hidden rounded-lg border">
                      {STATES.map((s) => (
                        <label key={s} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`perm:${p.key}`}
                            value={s}
                            defaultChecked={value === s}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "block px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
                              TONES[s]
                            )}
                          >
                            {STATE_LABELS[s]}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <SubmitButton>حفظ الصلاحيات</SubmitButton>
      </div>
    </form>
  );
}
