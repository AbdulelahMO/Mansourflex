"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TermFields } from "@/components/shared/term-fields";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { TriangleAlert, Lock } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/types";

const FREQUENCIES = [
  ["MONTHLY", "شهري"],
  ["QUARTERLY", "ربع سنوي"],
  ["SEMI_ANNUAL", "نصف سنوي"],
  ["ANNUAL", "سنوي"],
  ["ONE_TIME", "دفعة واحدة"],
] as const;

const AMOUNT_TYPES = [
  ["ANNUAL", "سنوي"],
  ["TOTAL", "إجمالي"],
  ["INCREASING", "متزايد"],
] as const;

export type ContractForEdit = {
  contractNumber: string;
  ejarContractNumber: string | null;
  startDate: string;
  endDate: string;
  rentAmount: number;
  amountType: string;
  increasePercent: number | null;
  vatRate: number;
  depositAmount: number | null;
  paymentFrequency: string;
  notes: string | null;
};

/**
 * Correcting a contract, in two parts. The details carry no consequence; the terms rebuild the
 * instalment schedule, so they are shown with what that will cost — and locked outright for
 * anyone but the administrator once documents have been issued against the schedule.
 */
export function ContractEditForm({
  contract,
  action,
  documentedCount,
  termsState,
}: {
  contract: ContractForEdit;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Instalments carrying a collection or a document — these are never rebuilt. */
  documentedCount: number;
  /** How this user holds the right to rebuild a schedule that already carries collections. */
  termsState: "ALLOW" | "APPROVE" | "DENY";
}) {
  const [amountType, setAmountType] = useState(contract.amountType);
  const [state, formAction] = useActionState(action, initialActionState);

  const locked = documentedCount > 0 && termsState === "DENY";
  const needsApproval = documentedCount > 0 && termsState === "APPROVE";

  return (
    <form action={formAction} className="space-y-4">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">بيانات العقد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ejarContractNumber">رقم العقد في إيجار</Label>
            <Input
              id="ejarContractNumber"
              name="ejarContractNumber"
              dir="ltr"
              defaultValue={contract.ejarContractNumber ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depositAmount">مبلغ الضمان</Label>
            <Input
              id="depositAmount"
              name="depositAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={contract.depositAmount ?? ""}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" name="notes" defaultValue={contract.notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">شروط العقد وجدول الأقساط</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          {locked ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                جرى تحصيل أو صدرت مستندات على {documentedCount} من أقساط هذا العقد، فشروطه مقفلة — تعديلها
                يعيد بناء جدول الأقساط. راجع مدير النظام.
              </span>
            </p>
          ) : (
            documentedCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  تعديل أي من هذه الشروط يعيد بناء جدول الأقساط. الأقساط التي جرى عليها تحصيل أو صدرت لها
                  مستندات ({documentedCount}) تبقى كما هي بمبالغها وفواتيرها وسنداتها، وتسري الشروط الجديدة على
                  ما بعدها.
                  {needsApproval && " ويحتاج ذلك موافقة مدير النظام، فاكتب سبب الطلب أدناه."}
                </span>
              </p>
            )
          )}

          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
            <TermFields defaultStart={contract.startDate} defaultEnd={contract.endDate} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rentAmount">قيمة الإيجار</Label>
                <Input
                  id="rentAmount"
                  name="rentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={contract.rentAmount}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountType">نوع المبلغ</Label>
                <Select name="amountType" value={amountType} onValueChange={(v) => v && setAmountType(v)} required>
                  <SelectTrigger className="w-full" id="amountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMOUNT_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {amountType === "INCREASING" && (
                <div className="space-y-1.5">
                  <Label htmlFor="increasePercent">نسبة الزيادة السنوية %</Label>
                  <Input
                    id="increasePercent"
                    name="increasePercent"
                    type="number"
                    step="0.1"
                    min="0.1"
                    defaultValue={contract.increasePercent ?? ""}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="paymentFrequency">دورية السداد</Label>
                <Select name="paymentFrequency" defaultValue={contract.paymentFrequency} required>
                  <SelectTrigger className="w-full" id="paymentFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vatRate">ضريبة القيمة المضافة</Label>
                <Select name="vatRate" defaultValue={String(contract.vatRate)} required>
                  <SelectTrigger className="w-full" id="vatRate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">بدون ضريبة</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="15">15%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {(needsApproval || state?.needsReason) && (
        <div className="space-y-1.5">
          <Label htmlFor="reason">سبب طلب تعديل الشروط</Label>
          <Textarea id="reason" name="reason" placeholder="يُعرض على مدير النظام مع الطلب" />
        </div>
      )}

      {state?.error && (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/contracts`}>إلغاء</Link>
        </Button>
        <SubmitButton>{needsApproval ? "حفظ وإرسال الطلب" : "حفظ التعديلات"}</SubmitButton>
      </div>
    </form>
  );
}
