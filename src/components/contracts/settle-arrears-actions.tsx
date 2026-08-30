"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DoorOpen, PiggyBank, Scale } from "lucide-react";
import { toast } from "sonner";
import { applyDepositToArrears, referContractArrearsToNajiz, vacateUnit } from "@/lib/actions/contracts";
import { formatCurrency } from "@/lib/format";

/**
 * The three ways out of arrears that stand between a finished lease and a rentable unit. They are
 * one path, not three choices: the deposit covers what it covers, Najiz pursues the rest, and the
 * written acknowledgement is for what neither fits. The unit is released in all three — the debt
 * stays on the contract regardless, so holding the flat empty only adds a second loss to the first.
 */
export function SettleArrearsActions({
  contractId,
  arrears,
  depositAvailable,
  allReferred,
}: {
  contractId: string;
  arrears: number;
  /** What is left of the security deposit after earlier applications. */
  depositAvailable: number;
  /** Every overdue instalment already referred to Najiz — the claim is formally running. */
  allReferred: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  const run = (work: () => Promise<{ error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await work();
      if (res.error) toast.error(res.error, { duration: 8000 });
      else {
        toast.success(res.message, { duration: 7000 });
        setAsking(false);
        setReason("");
      }
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {depositAvailable > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            title={`خصم ${formatCurrency(Math.min(depositAvailable, arrears))} من التأمين`}
            onClick={() => run(() => applyDepositToArrears(contractId))}
          >
            <PiggyBank className="size-4" />
            خصم من التأمين ({formatCurrency(depositAvailable)})
          </Button>
        )}

        {!allReferred && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            title="إحالة المتأخرات إلى ناجز لتبقى المطالبة قائمة"
            onClick={() => run(() => referContractArrearsToNajiz(contractId))}
          >
            <Scale className="size-4" />
            إحالة إلى ناجز
          </Button>
        )}

        <Button
          size="sm"
          variant={allReferred ? "outline" : "ghost"}
          disabled={pending}
          onClick={() => (allReferred ? run(() => vacateUnit(contractId)) : setAsking(true))}
        >
          <DoorOpen className="size-4" />
          {allReferred ? "إخلاء الوحدة" : "إخلاء بإقرار"}
        </Button>
      </div>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إخلاء الوحدة مع بقاء المستحقات</AlertDialogTitle>
            <AlertDialogDescription>
              تُخلى الوحدة وتصبح متاحة للتأجير، وتبقى مستحقات {formatCurrency(arrears)} مطالبةً على المستأجر في
              عقده المنتهي — تظهر في التحصيل وفي كشف حساب المالك ولا تسقط. اكتب سبب الإخلاء ليُقيَّد باسمك.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: تسوية ودّية بالتقسيط، أو المطالبة عبر المحامي"
            className="min-h-20"
          />

          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault();
                  if (!reason.trim()) return;
                  run(() => vacateUnit(contractId, reason));
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                إخلاء الوحدة
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
