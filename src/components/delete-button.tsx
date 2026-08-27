"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { initialActionState, type ActionState } from "@/lib/types";
import { getPermissionState } from "@/lib/actions/authz-client";

export function DeleteButton({
  action,
  title = "تأكيد الحذف",
  description = "هذا الإجراء لا يمكن التراجع عنه.",
  blockedReason,
  permission,
}: {
  action: (reason?: string, acknowledged?: boolean) => Promise<ActionState>;
  title?: string;
  description?: string;
  /** When set, deletion is not allowed — the button explains why instead of opening the dialog. */
  blockedReason?: string | null;
  /** Permission behind this action; lets the dialog say up-front that it needs approval. */
  permission?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, formAction] = useActionState(
    async (_prev: ActionState, input: { reason: string; acknowledged: boolean }) =>
      action(input.reason, input.acknowledged),
    initialActionState
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    // A plain refusal closes and explains itself; a "needs approval" answer keeps the dialog
    // open so the reason can be written in the same step.
    // A dues warning stays on screen to be confirmed; any other refusal closes and explains.
    if (state.error && !state.needsReason && !state.needsAcknowledge) {
      toast.error(state.error);
      setOpen(false);
    }
    if (state.success) {
      setOpen(false);
      if (state.message) toast.success(state.message);
    }
  }, [state]);

  // Asked once when the dialog opens, so the first screen already tells the truth.
  useEffect(() => {
    if (!open || !permission) return;
    let cancelled = false;
    getPermissionState(permission).then((s) => {
      if (!cancelled) setRequiresApproval(s === "APPROVE");
    });
    return () => {
      cancelled = true;
    };
  }, [open, permission]);

  const asRequest = requiresApproval || state.needsReason;
  const blocking = state.needsAcknowledge ? state.error : null;

  if (blockedReason) {
    return (
      <Button
        variant="ghost"
        size="icon"
        title={blockedReason}
        className="relative text-destructive/40 hover:text-destructive/40"
        onClick={() => toast.error("لا يمكن الحذف", { description: blockedReason })}
      >
        <Trash2 className="size-4" />
        <Ban className="absolute end-0.5 bottom-0.5 size-2.5 text-destructive" />
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{asRequest ? "طلب موافقة المدير" : title}</AlertDialogTitle>
          <AlertDialogDescription>
            {asRequest
              ? "هذا الإجراء يحتاج موافقة مدير النظام. اكتب سبب الطلب وسيُنفَّذ فور موافقته."
              : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocking && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{blocking}</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>أُقرّ بوجود هذه المستحقات وأريد المتابعة</span>
            </label>
          </div>
        )}
        {asRequest && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الطلب"
            className="min-h-20"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction asChild>
            <button
              onClick={(e) => {
                // Radix closes on confirm by default; the dialog is closed from the result instead,
                // so a request that still needs a reason does not vanish on the first click.
                e.preventDefault();
                if (asRequest && !reason.trim()) return;
                if (state.needsAcknowledge && !acknowledged) return;
                startTransition(() => formAction({ reason, acknowledged }));
              }}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-md px-4 py-2 text-sm"
            >
              {asRequest ? "إرسال الطلب" : "حذف"}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
