"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileText, Ban } from "lucide-react";
import { createInvoice } from "@/lib/actions/documents";
import { referPaymentToNajiz, cancelNajizReferral } from "@/lib/actions/najiz";

export function IssueDocumentButtons({
  paymentId,
  invoiceNumber,
  settled,
  najizReferredAt,
}: {
  paymentId: string;
  /** Number of the invoice already issued for this payment, if any — only one is allowed. */
  invoiceNumber: string | null;
  /** Paid in full and fully receipted — the payment's cycle is closed. */
  settled: boolean;
  najizReferredAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();

  const SETTLED_REASON = "الدفعة مكتملة: مدفوعة بالكامل وصادر لها سند قبض — لا توجد إجراءات متاحة.";

  const invoiceBlockedReason = settled
    ? SETTLED_REASON
    : invoiceNumber
      ? `سبق إصدار الفاتورة ${invoiceNumber} لهذه الدفعة — يُسمح بفاتورة واحدة فقط لكل دفعة.`
      : null;

  // There is no button for a receipt: recording the collection issues it, and issuing one by
  // hand could only acknowledge a lump of past collections as if it were a single handover.

  // A settled payment has nothing to refer, but an existing referral must stay cancellable
  // so a stale one can never be left stuck on a paid payment.
  const najizBlockedReason = settled && !najizReferredAt ? SETTLED_REASON : null;

  function issueInvoice() {
    // Explain the block instead of silently doing nothing; the server enforces it too.
    if (invoiceBlockedReason) {
      toast.error("لا يمكن إصدار فاتورة", { description: invoiceBlockedReason });
      return;
    }
    startTransition(async () => {
      const res = await createInvoice(paymentId);
      if (res.error) toast.error(res.error);
      else toast.success(res.message);
    });
  }

  function toggleNajiz() {
    if (najizBlockedReason) {
      toast.error("لا يمكن التحويل إلى ناجز", { description: najizBlockedReason });
      return;
    }
    startTransition(async () => {
      const res = najizReferredAt ? await cancelNajizReferral(paymentId) : await referPaymentToNajiz(paymentId);
      if (res.error) toast.error(res.error);
      else toast.success(res.message);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={issueInvoice}
        title={invoiceBlockedReason ?? "إصدار فاتورة"}
        className={invoiceBlockedReason ? "relative text-muted-foreground/50" : ""}
      >
        <FileText className="size-4" />
        {invoiceBlockedReason && <Ban className="absolute end-0.5 bottom-0.5 size-2.5 text-destructive" />}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={toggleNajiz}
        title={najizBlockedReason ?? (najizReferredAt ? "إلغاء الإحالة إلى ناجز" : "تحويل إلى ناجز")}
        className={
          najizBlockedReason ? "relative" : najizReferredAt ? "ring-1 ring-emerald-500/40" : ""
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/najiz-logo.png"
          alt="ناجز"
          className={`size-4.5 object-contain ${najizBlockedReason ? "opacity-40" : ""}`}
        />
        {najizBlockedReason && <Ban className="absolute end-0.5 bottom-0.5 size-2.5 text-destructive" />}
      </Button>
    </div>
  );
}

