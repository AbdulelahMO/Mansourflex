import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { FileText } from "lucide-react";

export type OutstandingContract = {
  id: string;
  contractNumber: string;
  unitLabel: string;
  tenantName: string;
  outstandingAmount: number;
};

export function OutstandingContractsList({ items, total }: { items: OutstandingContract[]; total: number }) {
  return (
    <Card className="h-full py-0 gap-0">
      <CardHeader className="flex-row items-center justify-between border-b py-3.5">
        <CardTitle className="text-base">عقود غير مصفاة ({total})</CardTitle>
        <Link href="/contracts" className="text-xs text-primary hover:underline">
          عرض الكل
        </Link>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-y-auto p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
            <FileText className="size-8" />
            <p className="text-sm">لا توجد عقود بمستحقات غير مصفاة</p>
          </div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold">عقد رقم {c.contractNumber}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.unitLabel} · {c.tenantName}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-red-600">{formatCurrency(c.outstandingAmount)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
