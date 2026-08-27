"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleIntegration } from "@/lib/actions/integrations";

export function ToggleActive({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={isActive}
      disabled={pending}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const res = await toggleIntegration(id, checked);
          if (res.error) toast.error(res.error);
        })
      }
    />
  );
}
