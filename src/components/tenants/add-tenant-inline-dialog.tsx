"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { TenantFields } from "@/components/tenants/tenant-dialogs";
import { createTenantInline, type TenantActionState } from "@/lib/actions/tenants";
import { Plus } from "lucide-react";

const initialState: TenantActionState = {};

/**
 * Adding a tenant without leaving contract creation. It renders the same fields as the
 * tenants page so a tenant is never half-recorded just because of where it was added from;
 * the only difference is that the new tenant is handed back to the contract form.
 */
export function AddTenantInlineDialog({ onCreated }: { onCreated: (tenant: { id: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createTenantInline, initialState);

  useEffect(() => {
    if (state.success && state.tenant) {
      onCreated(state.tenant);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" title="إضافة مستأجر جديد">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة مستأجر جديد</DialogTitle>
          <DialogDescription>يُضاف المستأجر ويُختار في العقد مباشرة</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <TenantFields />
          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>إضافة</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
