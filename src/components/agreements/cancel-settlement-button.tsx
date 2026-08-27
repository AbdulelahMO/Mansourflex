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
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cancelSettlement } from "@/lib/actions/agreements";
import { initialActionState, type ActionState } from "@/lib/types";
import { getPermissionState } from "@/lib/actions/authz-client";

/** Escape hatch for a settlement entered by mistake — it reopens the agreement for a correct one. */
export function CancelSettlementButton({ agreementId }: { agreementId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [state, formAction] = useActionState(
    async (_prev: ActionState, value: string) => cancelSettlement(agreementId, value),
    initialActionState
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.error && !state.needsReason) {
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
    if (!open) return;
    let cancelled = false;
    getPermissionState("agreements.cancelSettlement").then((s) => {
      if (!cancelled) setRequiresApproval(s === "APPROVE");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const asRequest = requiresApproval || state.needsReason;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Undo2 className="size-4" />
          إلغاء التصفية
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{asRequest ? "طلب موافقة المدير" : "إلغاء التصفية"}</AlertDialogTitle>
          <AlertDialogDescription>
            {asRequest
              ? "إلغاء التصفية يحتاج موافقة مدير النظام. اكتب سبب الطلب وسيُنفَّذ فور موافقته."
              : "سيُحذف كشف التصفية المحفوظ نهائياً، وتعود الاتفاقية سارية بتاريخ نهايتها الأصلي، ويمكنك تصفيتها من جديد بالأرقام الصحيحة. استخدم هذا الخيار عند اعتماد تصفية بالخطأ فقط."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {asRequest && (
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الطلب" className="min-h-20" />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (asRequest && !reason.trim()) return;
                startTransition(() => formAction(reason));
              }}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-md px-4 py-2 text-sm"
            >
              {asRequest ? "إرسال الطلب" : "إلغاء التصفية"}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
