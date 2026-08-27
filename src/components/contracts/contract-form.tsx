"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ContractFields, type BuildingOption, type UnitOption, type TenantOption } from "@/components/contracts/contract-fields";
import { createContract } from "@/lib/actions/contracts";
import { initialActionState } from "@/lib/types";

export function ContractForm({
  buildings,
  units,
  tenants,
}: {
  buildings: BuildingOption[];
  units: UnitOption[];
  tenants: TenantOption[];
}) {
  const [state, formAction] = useActionState(createContract, initialActionState);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-5">
          <ContractFields buildings={buildings} units={units} tenants={tenants} />

          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href="/contracts">إلغاء</Link>
            </Button>
            <SubmitButton>إنشاء العقد</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
