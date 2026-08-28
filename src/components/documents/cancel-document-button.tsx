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
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { getPermissionState } from "@/lib/actions/authz-client";
import { initialActionState, type ActionState } from "@/lib/types";

/**
 * Voids a financial document instead of deleting it: the number stays, the reason is kept,
 * and the figures stop counting it. A reason is always required — the point of cancelling
 * rather than deleting is that the record explains itself later.
 */
export function CancelDocumentButton({
  documentNumber,
  action,
  description,
  cancelled,
  permission = "documents.cancel",
  title = "إلغاء المستند",
  heading,
  confirmLabel,
  approvalNote = "إلغاء المستندات المالية يحتاج موافقة مدير النظام. اكتب السبب وسيُنفَّذ فور موافقته.",
}: {
  documentNumber: string;
  action: (reason?: string) => Promise<ActionState>;
  description?: string;
  cancelled?: boolean;
  /** Which permission gates it — a receipt is undone through its collection, not cancelled. */
  permission?: string;
  title?: string;
  heading?: string;
  confirmLabel?: string;
  approvalNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [state, formAction] = useActionState(
    async (_prev: ActionState, value: string) => action(value),
    initialActionState
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.error && !state.needsReason) {
      toast.error(state.error, { duration: 7000 });
      setOpen(false);
    }
    if (state.success) {
      setOpen(false);
      if (state.message) toast.success(state.message);
    }
  }, [state]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    getPermissionState(permission).then((s) => {
      if (!cancel) setNeedsApproval(s === "APPROVE");
    });
    return () => {
      cancel = true;
    };
  }, [open, permission]);

  if (cancelled) {
    return <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">ملغى</span>;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title={title} className="text-destructive hover:text-destructive">
          <Ban className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {needsApproval ? `طلب ${title}` : `${heading ?? title} ${documentNumber}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {needsApproval
              ? approvalNote
              : (description ??
                "يبقى المستند برقمه مختوماً بـ«ملغى» مع سبب الإلغاء واسم من ألغاه، ويخرج من كل الحسابات والتقارير. لا يُحذف نهائياً.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الإلغاء (مطلوب)"
          className="min-h-20"
        />

        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (!reason.trim()) return;
                startTransition(() => formAction(reason));
              }}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-white hover:bg-destructive/90"
            >
              {needsApproval ? "إرسال الطلب" : (confirmLabel ?? title)}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
