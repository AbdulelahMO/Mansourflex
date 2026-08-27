"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/form-dialog";
import { renewContract } from "@/lib/actions/contracts";
import { RefreshCw } from "lucide-react";

type ContractSummary = {
  id: string;
  contractNumber: string;
  endDate: Date | string;
  rentAmount: number;
  /** Already renewed once — the option is shown as blocked rather than hidden. */
  renewedToNumber?: string | null;
};

const day = 24 * 60 * 60 * 1000;
const toInput = (d: Date) => d.toISOString().slice(0, 10);

/** تجديد: a new contract for the same unit and tenant, with its own number and terms. */
export function RenewContractDialog({ contract }: { contract: ContractSummary }) {
  const end = new Date(contract.endDate);
  const start = new Date(end.getTime() + day);
  const newEnd = new Date(start);
  newEnd.setFullYear(newEnd.getFullYear() + 1);
  newEnd.setDate(newEnd.getDate() - 1);

  if (contract.renewedToNumber) {
    return (
      <Button variant="outline" size="sm" disabled title={`سبق تجديد هذا العقد (${contract.renewedToNumber})`}>
        <RefreshCw className="size-4" />
        مُجدَّد
      </Button>
    );
  }

  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <RefreshCw className="size-4" />
          تجديد
        </Button>
      }
      title="تجديد العقد"
      description={`ينشأ عقد جديد لنفس الوحدة والمستأجر بجدول دفعات جديد، ويُصبح ${contract.contractNumber} منتهياً`}
      action={renewContract.bind(null, contract.id)}
      submitLabel="إنشاء العقد الجديد"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">
            البداية <span className="text-destructive">*</span>
          </Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={toInput(start)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">
            النهاية <span className="text-destructive">*</span>
          </Label>
          <Input id="endDate" name="endDate" type="date" required defaultValue={toInput(newEnd)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rentAmount">
            قيمة الإيجار <span className="text-destructive">*</span>
          </Label>
          <Input
            id="rentAmount"
            name="rentAmount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={contract.rentAmount}
          />
          <p className="text-xs text-muted-foreground">عدّلها إن اتُّفق على قيمة جديدة عند التجديد.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ejarContractNumber">رقم عقد إيجار</Label>
          <Input id="ejarContractNumber" name="ejarContractNumber" dir="ltr" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" />
      </div>

      <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        يصدر رقم العقد الجديد تلقائياً، وتُنقل الدورية ونوع القيمة ونسبة الضريبة والتأمين من العقد الحالي كما هي.
      </p>
    </FormDialog>
  );
}
