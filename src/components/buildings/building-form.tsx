"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { BuildingFields, type Owner, type BuildingFormValues } from "@/components/buildings/building-fields";
import { initialActionState, type ActionState } from "@/lib/types";

export function BuildingForm({
  owners,
  building,
  action,
  submitLabel,
}: {
  owners: Owner[];
  building?: BuildingFormValues;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <BuildingFields owners={owners} building={building} />

          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href="/buildings">إلغاء</Link>
            </Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
