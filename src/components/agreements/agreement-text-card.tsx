"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { FileSignature } from "lucide-react";
import { updateAgreementText } from "@/lib/actions/organization";
import { DEFAULT_AGREEMENT_PREAMBLE, DEFAULT_AGREEMENT_CLOSING } from "@/lib/agreement-text";
import { initialActionState, type ActionState } from "@/lib/types";

/**
 * The wording every management agreement is printed with. It belongs beside the agreements
 * because that is where someone goes to change how an agreement reads — it was filed under the
 * organisation's own details, where nobody would think to look for a contract clause.
 */
export function AgreementTextCard({
  preamble,
  closing,
}: {
  preamble: string | null;
  closing: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateAgreementText, initialActionState);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="size-4" />
          نصوص الاتفاقية
        </CardTitle>
      </CardHeader>

      <CardContent className="py-4">
        <p className="mb-3 text-xs text-muted-foreground">
          تُطبع في كل اتفاقية إدارة. اتركها فارغة لاستخدام الصياغة الافتراضية.
        </p>

        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agreementPreamble">التمهيد</Label>
            <Textarea
              id="agreementPreamble"
              name="agreementPreamble"
              rows={4}
              defaultValue={preamble ?? ""}
              placeholder={DEFAULT_AGREEMENT_PREAMBLE}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agreementClosing">الخاتمة (قبل التوقيعات)</Label>
            <Textarea
              id="agreementClosing"
              name="agreementClosing"
              rows={2}
              defaultValue={closing ?? ""}
              placeholder={DEFAULT_AGREEMENT_CLOSING}
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SubmitButton size="sm">حفظ النصوص</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
