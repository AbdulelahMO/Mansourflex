"use client";

import { useActionState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { createExpenseVoucher } from "@/lib/actions/expenses";
import { initialActionState } from "@/lib/types";

/** For an expense already settled without one — a voucher deleted, or a payment recorded by editing. */
export function IssueVoucherButton({ expenseId }: { expenseId: string }) {
  const [state, formAction] = useActionState(async () => createExpenseVoucher(expenseId), initialActionState);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success && state.message) toast.success(state.message);
  }, [state]);

  return (
    <Button
      size="sm"
      variant="outline"
      title="إصدار سند صرف"
      disabled={pending}
      onClick={() => startTransition(() => formAction())}
    >
      <FileText className="size-4" />
      سند صرف
    </Button>
  );
}
