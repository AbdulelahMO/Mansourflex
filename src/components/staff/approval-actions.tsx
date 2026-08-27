"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveRequest, rejectRequest } from "@/lib/actions/staff";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

/** Approving runs the stored action immediately; a failure surfaces its reason unchanged. */
export function ApprovalActions({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

  useEffect(() => {
    if (result?.error) toast.error(result.error, { duration: 8000 });
    if (result?.message) toast.success(result.message);
  }, [result]);

  function decide(approve: boolean) {
    startTransition(async () => {
      setResult(await (approve ? approveRequest(id, note) : rejectRequest(id, note)));
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة على القرار (اختياري)"
        className="min-h-16"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide(true)}>
          <Check className="size-4" />
          موافقة وتنفيذ
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(false)}>
          <X className="size-4" />
          رفض
        </Button>
      </div>
    </div>
  );
}
