"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  AgreementFields,
  type AgreementValues,
  type AgreementBuildingOption,
} from "@/components/agreements/agreement-fields";
import { initialActionState, type ActionState } from "@/lib/types";

export function AgreementForm({
  owners,
  buildings,
  agreement,
  action,
  submitLabel,
  cancelHref = "/agreements",
}: {
  owners: { id: string; name: string }[];
  buildings: AgreementBuildingOption[];
  agreement?: AgreementValues;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <AgreementFields owners={owners} buildings={buildings} agreement={agreement} />

          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href={cancelHref}>إلغاء</Link>
            </Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
