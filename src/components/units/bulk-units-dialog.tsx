"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { createUnitsBulk } from "@/lib/actions/units";
import { buildUnitNumbers, MAX_BULK_UNITS, type NumberingMode } from "@/lib/unit-numbering";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

const UNIT_TYPE_OPTIONS = ["شقة", "محل", "مكتب", "دور", "استوديو", "مستودع", "معرض", "غرفة", "أخرى"];

/**
 * Adds a building's units in one pass. The numbers are previewed before anything is written —
 * a wrong floor count is cheap to notice here and expensive to undo after thirty rows exist.
 */
export function BulkUnitsDialog({ buildingId }: { buildingId: string }) {
  const [mode, setMode] = useState<NumberingMode>("floors");
  const [floors, setFloors] = useState("3");
  const [perFloor, setPerFloor] = useState("4");
  const [firstFloor, setFirstFloor] = useState("1");
  const [count, setCount] = useState("10");
  const [startFrom, setStartFrom] = useState("1");
  const [prefix, setPrefix] = useState("");

  const preview = useMemo(
    () =>
      buildUnitNumbers({
        mode,
        floors: Number(floors || 0),
        perFloor: Number(perFloor || 0),
        firstFloor: firstFloor === "" ? 1 : Number(firstFloor),
        count: Number(count || 0),
        startFrom: startFrom === "" ? 1 : Number(startFrom),
        prefix,
      }),
    [mode, floors, perFloor, firstFloor, count, startFrom, prefix]
  );

  const atCeiling = preview.length >= MAX_BULK_UNITS;

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Layers className="size-4" />
          إضافة وحدات دفعة
        </Button>
      }
      title="إضافة وحدات دفعة واحدة"
      description="تُنشأ الوحدات متطابقة، ثم تُعدَّل منها ما اختلف — أسرع من إدخال كل وحدة على حدة."
      action={createUnitsBulk}
      submitLabel={preview.length ? `إنشاء ${preview.length} وحدة` : "إنشاء"}
    >
      <input type="hidden" name="buildingId" value={buildingId} />
      <input type="hidden" name="mode" value={mode} />

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["floors", "ترقيم بالطوابق"],
            ["sequential", "ترقيم متسلسل"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
              mode === value ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "floors" ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="floors">عدد الطوابق</Label>
            <Input id="floors" name="floors" type="number" min="1" value={floors} onChange={(e) => setFloors(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perFloor">وحدات كل طابق</Label>
            <Input id="perFloor" name="perFloor" type="number" min="1" value={perFloor} onChange={(e) => setPerFloor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="firstFloor">أول طابق</Label>
            <Input id="firstFloor" name="firstFloor" type="number" value={firstFloor} onChange={(e) => setFirstFloor(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">0 للدور الأرضي</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="count">عدد الوحدات</Label>
            <Input id="count" name="count" type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startFrom">يبدأ من</Label>
            <Input id="startFrom" name="startFrom" type="number" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            {/* «سابقة» is the right word and the wrong label: it is grammar, not something an
                operator says. What they want to know is where what they type ends up. */}
            <Label htmlFor="prefix">حرف قبل الرقم</Label>
            <Input id="prefix" name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="M" />
            <p className="text-[11px] text-muted-foreground">اختياري — M تعطي M1 M2</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium">
          الأرقام التي ستُنشأ ({preview.length})
          {atCeiling && <span className="text-destructive"> — بلغتَ الحد الأقصى {MAX_BULK_UNITS}</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
          {preview.length === 0
            ? "—"
            : preview.slice(0, 24).map((u) => u.unitNumber).join(" · ") + (preview.length > 24 ? ` … +${preview.length - 24}` : "")}
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          الأرقام الموجودة في المبنى تُتخطّى ولا تمنع الباقي.
        </p>
      </div>

      <p className="text-sm font-medium">بيانات تُنسخ على الجميع</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulkUnitType">نوع الوحدة</Label>
          <Select name="unitType" defaultValue="شقة">
            <SelectTrigger className="w-full" id="bulkUnitType">
              <SelectValue placeholder="اختر النوع" />
            </SelectTrigger>
            <SelectContent>
              {UNIT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulkStatus">الحالة</Label>
          <Select name="status" defaultValue="VACANT">
            <SelectTrigger className="w-full" id="bulkStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VACANT">شاغرة</SelectItem>
              <SelectItem value="MAINTENANCE">تحت الصيانة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulkArea">المساحة (م²)</Label>
          <Input id="bulkArea" name="areaSqm" type="number" step="0.01" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulkBedrooms">غرف</Label>
          <Input id="bulkBedrooms" name="bedrooms" type="number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulkBathrooms">دورات مياه</Label>
          <Input id="bulkBathrooms" name="bathrooms" type="number" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulkRent">قيمة الإيجار السنوي (ر.س)</Label>
        <Input id="bulkRent" name="rentAmount" type="number" step="0.01" />
      </div>
    </FormDialog>
  );
}
