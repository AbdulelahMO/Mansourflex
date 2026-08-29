"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { createUnit, updateUnit } from "@/lib/actions/units";
import { Plus, Pencil } from "lucide-react";

/**
 * What the unit is. It was a free text box, so it filled up with the building's sector —
 * «سكني» and «تجاري» — which describes use, not the unit, and left the occupancy-by-type
 * figures counting a spelling as a type. A stored value outside this list is kept as an option
 * of its own, so opening an old unit never silently drops what it already says.
 */
const UNIT_TYPE_OPTIONS = ["شقة", "محل", "مكتب", "دور", "استوديو", "مستودع", "معرض", "غرفة", "أخرى"];

type Unit = {
  id: string;
  buildingId: string;
  unitNumber: string;
  floor: string | null;
  unitType: string | null;
  areaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rentAmount: number | null;
  status: "VACANT" | "OCCUPIED" | "MAINTENANCE";
  notes: string | null;
};

function UnitFields({
  unit,
  buildings,
}: {
  unit?: Unit;
  buildings?: { id: string; name: string }[];
}) {
  return (
    <>
      {buildings && (
        <div className="space-y-1.5">
          <Label htmlFor="buildingId">المبنى</Label>
          <Select name="buildingId" required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر المبنى" />
            </SelectTrigger>
            <SelectContent>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="unitNumber">رقم الوحدة</Label>
          <Input id="unitNumber" name="unitNumber" required defaultValue={unit?.unitNumber} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="floor">الطابق</Label>
          <Input id="floor" name="floor" defaultValue={unit?.floor ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="unitType">نوع الوحدة</Label>
          <Select name="unitType" defaultValue={unit?.unitType ?? undefined}>
            <SelectTrigger className="w-full" id="unitType">
              <SelectValue placeholder="اختر نوع الوحدة" />
            </SelectTrigger>
            <SelectContent>
              {[
                ...UNIT_TYPE_OPTIONS,
                ...(unit?.unitType && !UNIT_TYPE_OPTIONS.includes(unit.unitType) ? [unit.unitType] : []),
              ].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">الحالة</Label>
          {unit?.status === "OCCUPIED" ? (
            // Occupancy is the contract's to say, not a field to type: it is set when a contract
            // is written and released when it ends. Offering it here let a unit be marked rented
            // with no tenant behind it — counted as occupied, and hidden from the next contract.
            <>
              <div className="flex h-11 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground md:h-8">
                مؤجرة — بعقد ساري
              </div>
              <input type="hidden" name="status" value="OCCUPIED" />
              <p className="text-xs text-muted-foreground">تتبع الحالة عقدها، فتعود شاغرة عند انتهائه أو فسخه.</p>
            </>
          ) : (
            <Select name="status" defaultValue={unit?.status ?? "VACANT"} required>
              <SelectTrigger className="w-full" id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VACANT">شاغرة</SelectItem>
                <SelectItem value="MAINTENANCE">تحت الصيانة</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="areaSqm">المساحة (م²)</Label>
          <Input id="areaSqm" name="areaSqm" type="number" step="0.01" defaultValue={unit?.areaSqm ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bedrooms">غرف</Label>
          <Input id="bedrooms" name="bedrooms" type="number" defaultValue={unit?.bedrooms ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bathrooms">دورات مياه</Label>
          <Input id="bathrooms" name="bathrooms" type="number" defaultValue={unit?.bathrooms ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rentAmount">قيمة الإيجار السنوي (ر.س)</Label>
        <Input id="rentAmount" name="rentAmount" type="number" step="0.01" defaultValue={unit?.rentAmount ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea id="notes" name="notes" defaultValue={unit?.notes ?? ""} />
      </div>
    </>
  );
}

export function CreateUnitDialog({
  buildingId,
  buildings,
}: {
  buildingId?: string;
  buildings?: { id: string; name: string }[];
}) {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          إضافة وحدة
        </Button>
      }
      title="إضافة وحدة جديدة"
      action={createUnit}
      submitLabel="إضافة"
    >
      {buildingId && <input type="hidden" name="buildingId" value={buildingId} />}
      <UnitFields buildings={buildings} />
    </FormDialog>
  );
}

export function EditUnitDialog({ unit }: { unit: Unit }) {
  const action = updateUnit.bind(null, unit.id);
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon">
          <Pencil className="size-4" />
        </Button>
      }
      title="تعديل الوحدة"
      action={action}
      submitLabel="حفظ التعديلات"
    >
      <input type="hidden" name="buildingId" value={unit.buildingId} />
      <UnitFields unit={unit} />
    </FormDialog>
  );
}
