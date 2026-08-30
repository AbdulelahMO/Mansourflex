"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { vacateUnit } from "@/lib/actions/contracts";

/**
 * Releases the unit after a lease has ended. Separate from ending the contract because they are
 * separate facts: the lease is over on its date, but the unit is only free once the tenant is
 * out and nothing is owed — and only someone who knows that can say so.
 */
export function VacateUnitButton({ contractId, arrears }: { contractId: string; arrears: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending || arrears > 0}
      title={arrears > 0 ? "لا تُخلى الوحدة قبل تسوية المستحقات" : "تحويل الوحدة إلى شاغرة"}
      onClick={() =>
        startTransition(async () => {
          const res = await vacateUnit(contractId);
          if (res.error) toast.error(res.error, { duration: 7000 });
          else toast.success(res.message);
        })
      }
    >
      <DoorOpen className="size-4" />
      إخلاء الوحدة
    </Button>
  );
}
