"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TermFields } from "@/components/shared/term-fields";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddTenantInlineDialog } from "@/components/tenants/add-tenant-inline-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildPaymentSchedule, type RentAmountType, type ScheduledPayment } from "@/lib/payment-schedule";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

const AMOUNT_TYPE_OPTIONS: { value: "ANNUAL" | "TOTAL" | "INCREASING"; label: string }[] = [
  { value: "ANNUAL", label: "سنوي" },
  { value: "TOTAL", label: "إجمالي" },
  { value: "INCREASING", label: "متزايد" },
];

export type BuildingOption = { id: string; name: string };
export type UnitOption = {
  id: string;
  unitNumber: string;
  status: string;
  rentAmount: number | null;
  buildingId: string;
  building: { name: string };
};
export type TenantOption = { id: string; name: string };

function PaymentSchedulePreview({ schedule }: { schedule: ScheduledPayment[] | null }) {
  if (!schedule || schedule.length === 0) return null;

  const totals = schedule.reduce(
    (sum, p) => ({ base: sum.base + p.baseAmount, vat: sum.vat + p.vatAmount, total: sum.total + p.amount }),
    { base: 0, vat: 0, total: 0 }
  );

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center gap-2 space-y-0 border-b py-3.5">
        <CalendarClock className="size-4 text-primary" />
        <CardTitle className="text-base">جدول الدفعات المتوقع ({schedule.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>تاريخ الإصدار</TableHead>
                <TableHead>تاريخ الإستحقاق</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الضريبة</TableHead>
                <TableHead>الخدمات</TableHead>
                <TableHead>المجموع</TableHead>
                <TableHead>المبلغ المدفوع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>{formatDate(p.dueDate)}</TableCell>
                  <TableCell>{formatDate(p.dueDate)}</TableCell>
                  <TableCell>{formatCurrency(p.baseAmount)}</TableCell>
                  <TableCell>{formatCurrency(p.vatAmount)}</TableCell>
                  <TableCell className="text-muted-foreground">0</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">0</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t px-4 py-3 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">إجمالي المبلغ: </span>
            <span className="font-semibold">{formatCurrency(totals.base)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">إجمالي الضريبة: </span>
            <span className="font-semibold">{formatCurrency(totals.vat)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">الإجمالي الكلي: </span>
            <span className="font-semibold">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContractFields({
  buildings,
  units,
  tenants,
}: {
  buildings: BuildingOption[];
  units: UnitOption[];
  tenants: TenantOption[];
}) {
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantsList, setTenantsList] = useState(tenants);
  const [tenantId, setTenantId] = useState("");
  const [amountType, setAmountType] = useState<RentAmountType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [increasePercent, setIncreasePercent] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState("QUARTERLY");
  const [vatRate, setVatRate] = useState("15");

  const filteredUnits = useMemo(
    () => (buildingId ? units.filter((u) => u.buildingId === buildingId) : units),
    [units, buildingId]
  );

  /** How many units in each building can actually take a new contract. */
  const availableByBuilding = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of units) {
      if (u.status === "OCCUPIED") continue;
      counts.set(u.buildingId, (counts.get(u.buildingId) ?? 0) + 1);
    }
    return counts;
  }, [units]);

  const schedule = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const amount = Number(rentAmount);
    if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const incPct = Number(increasePercent) || 0;
    if (amountType === "INCREASING" && incPct <= 0) return null;

    return buildPaymentSchedule(start, end, amount, paymentFrequency, amountType, incPct, Number(vatRate));
  }, [startDate, endDate, rentAmount, increasePercent, paymentFrequency, vatRate, amountType]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="buildingFilter">المبنى</Label>
          <Select
            value={buildingId}
            onValueChange={(v) => {
              if (!v) return;
              setBuildingId(v);
              setUnitId("");
            }}
          >
            <SelectTrigger className="w-full" id="buildingFilter">
              <SelectValue placeholder="اختر المبنى" />
            </SelectTrigger>
            <SelectContent>
              {buildings.map((b) => {
                // A building with nothing free is shown but not selectable, so the reason is visible.
                const available = availableByBuilding.get(b.id) ?? 0;
                return (
                  <SelectItem key={b.id} value={b.id} disabled={available === 0}>
                    {b.name}
                    {available === 0 && <span className="text-muted-foreground"> — لا يوجد شاغر</span>}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unitId">الوحدة</Label>
          <Select value={unitId} onValueChange={(v) => v && setUnitId(v)} required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر الوحدة">
                {(() => {
                  const u = filteredUnits.find((x) => x.id === unitId);
                  return u ? `${u.building.name} - وحدة ${u.unitNumber}` : undefined;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredUnits.map((u) => (
                <SelectItem key={u.id} value={u.id} disabled={u.status === "OCCUPIED"}>
                  {u.building.name} - وحدة {u.unitNumber}
                  {u.status === "OCCUPIED" && <span className="text-muted-foreground"> (مؤجرة)</span>}
                  {u.status === "MAINTENANCE" && <span className="text-amber-600"> (تحت الصيانة)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="unitId" value={unitId} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ejarContractNumber">رقم عقد إيجار (منصة إيجار)</Label>
          <Input id="ejarContractNumber" name="ejarContractNumber" dir="ltr" placeholder="اختياري" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tenantId">المستأجر</Label>
          <div className="flex gap-2">
            <AddTenantInlineDialog
              onCreated={(tenant) => {
                setTenantsList((list) => [...list, tenant]);
                setTenantId(tenant.id);
              }}
            />
            <Select value={tenantId} onValueChange={(v) => v && setTenantId(v)} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر المستأجر">
                  {tenantsList.find((t) => t.id === tenantId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tenantsList.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input type="hidden" name="tenantId" value={tenantId} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TermFields
          onChange={({ startDate: s, endDate: e }) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
      </div>

      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", amountType === "INCREASING" ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        <div className="space-y-1.5">
          <Label htmlFor="rentAmount">قيمة الإيجار</Label>
          <div className="flex gap-2">
            <Input
              id="rentAmount"
              name="rentAmount"
              type="number"
              step="0.01"
              required
              className="flex-1"
              onChange={(e) => setRentAmount(e.target.value)}
            />
            <Select name="amountType" value={amountType} onValueChange={(v) => v && setAmountType(v as typeof amountType)} required>
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AMOUNT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vatRate">ضريبة القيمة المضافة</Label>
          <Select name="vatRate" value={vatRate} onValueChange={(v) => v && setVatRate(v)} required>
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

        {amountType === "INCREASING" && (
          <div className="space-y-1.5">
            <Label htmlFor="increasePercent">نسبة الزيادة السنوية (%)</Label>
            <Input
              id="increasePercent"
              name="increasePercent"
              type="number"
              step="0.01"
              min="0"
              required
              onChange={(e) => setIncreasePercent(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="paymentFrequency">طريقة السداد</Label>
          <Select name="paymentFrequency" value={paymentFrequency} onValueChange={(v) => v && setPaymentFrequency(v)} required>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">شهري</SelectItem>
              <SelectItem value="QUARTERLY">ربع سنوي</SelectItem>
              <SelectItem value="SEMI_ANNUAL">نصف سنوي</SelectItem>
              <SelectItem value="ANNUAL">سنوي</SelectItem>
              <SelectItem value="ONE_TIME">دفعة واحدة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="depositAmount">التأمين (ر.س)</Label>
          <Input id="depositAmount" name="depositAmount" type="number" step="0.01" />
        </div>
      </div>

      <PaymentSchedulePreview schedule={schedule} />

      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" />
      </div>
    </>
  );
}
