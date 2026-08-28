"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationMapPicker } from "@/components/buildings/location-map-picker";
import { AddOwnerInlineDialog } from "@/components/owners/add-owner-inline-dialog";
import { toDateInputValue } from "@/lib/format";
import { formatHijri, gregorianToHijri, hijriToGregorian, HIJRI_MONTHS } from "@/lib/hijri";
import { Plus, Trash2, ChevronDown, ChevronUp, Paperclip, Image as ImageIcon } from "lucide-react";

export type Owner = { id: string; name: string };
export type BuildingContactValue = { name: string; role: string | null; phone: string | null; note: string | null };
export type BuildingMeterValue = {
  type: "ELECTRICITY" | "WATER";
  meterNumber: string | null;
  subscriptionNumber: string | null;
};
export type BuildingFormValues = {
  id: string;
  name: string;
  nameEn: string | null;
  ownerId: string;
  sector: string | null;
  usageType: string | null;
  propertyType: string | null;
  propertyNumber: string | null;
  complexName: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  streetName: string | null;
  postalCode: string | null;
  buildingNumber: string | null;
  additionalNumber: string | null;
  plotNumber: string | null;
  blockNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  deedType: string | null;
  deedNumber: string | null;
  deedIssueDate: Date | string | null;
  deedFileUrl: string | null;
  description: string | null;
  shopsCount: number | null;
  apartmentsCount: number | null;
  elevatorsCount: number | null;
  areaSqm: number | null;
  constructionDate: Date | string | null;
  floorsCount: number | null;
  unitsPerFloor: number | null;
  notes: string | null;
  contacts?: BuildingContactValue[];
  meters?: BuildingMeterValue[];
};

const SECTOR_OPTIONS = ["تجاري", "سكني", "تجاري - سكني", "صناعي", "زراعي"];
const PROPERTY_TYPE_OPTIONS = ["برج", "عمارة سكنية", "فيلا", "مجمع سكني", "مجمع تجاري", "أخرى"];
const DEED_TYPE_OPTIONS = ["صك إلكتروني", "صك ورقي", "عقد ابتدائي", "أخرى"];
const REGIONS = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
];

function LabeledSelect({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Select name={name} defaultValue={defaultValue ?? undefined} required={required}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`اختر ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Gregorian date input for the deed issue date, with the equivalent Hijri date shown alongside as a read-only hint. */
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Deeds are dated by the Hijri calendar, so the date can be entered either way and the
 * other is shown alongside. Whichever is used, a Gregorian value is what gets submitted.
 */
function DeedIssueDateField({ defaultValue }: { defaultValue?: string | Date | null }) {
  const [value, setValue] = useState(() => toDateInputValue(defaultValue));
  const [calendar, setCalendar] = useState<"gregorian" | "hijri">("gregorian");

  const initialHijri = value ? gregorianToHijri(new Date(value)) : null;
  const [hy, setHy] = useState(initialHijri ? String(initialHijri.year) : "");
  const [hm, setHm] = useState(initialHijri ? String(initialHijri.month) : "");
  const [hd, setHd] = useState(initialHijri ? String(initialHijri.day) : "");

  function applyGregorian(next: string) {
    setValue(next);
    const h = next ? gregorianToHijri(new Date(next)) : null;
    setHy(h ? String(h.year) : "");
    setHm(h ? String(h.month) : "");
    setHd(h ? String(h.day) : "");
  }

  function applyHijri(y: string, m: string, d: string) {
    setHy(y);
    setHm(m);
    setHd(d);
    const g = y && m && d ? hijriToGregorian(Number(y), Number(m), Number(d)) : null;
    setValue(g ? toISODate(g) : "");
  }

  const hijriIncomplete = !!(hy && hm && hd) && !value;
  const gregorianText = value
    ? new Date(value).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="deedIssueDate">تاريخ إصدار الصك</Label>
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[11px]">
          {([
            ["gregorian", "ميلادي"],
            ["hijri", "هجري"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCalendar(key)}
              className={
                "rounded px-3 py-0.5 font-medium max-md:min-h-9 " +
                (calendar === key ? "bg-background shadow-sm" : "text-muted-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {calendar === "gregorian" ? (
        <Input
          id="deedIssueDate"
          name="deedIssueDate"
          type="date"
          value={value}
          onChange={(e) => applyGregorian(e.target.value)}
        />
      ) : (
        <>
          <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-1.5" dir="rtl">
            <Input
              aria-label="اليوم"
              placeholder="يوم"
              inputMode="numeric"
              value={hd}
              onChange={(e) => applyHijri(hy, hm, e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            <select
              aria-label="الشهر"
              value={hm}
              onChange={(e) => applyHijri(hy, e.target.value, hd)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">الشهر</option>
              {HIJRI_MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <Input
              aria-label="السنة"
              placeholder="سنة"
              inputMode="numeric"
              value={hy}
              onChange={(e) => applyHijri(e.target.value.replace(/\D/g, "").slice(0, 4), hm, hd)}
            />
          </div>
          {/* The form always submits a Gregorian value, whichever calendar was typed in. */}
          <input type="hidden" name="deedIssueDate" value={value} />
        </>
      )}

      {calendar === "gregorian" && value && (
        <p className="text-xs text-muted-foreground">{formatHijri(new Date(value))}</p>
      )}
      {calendar === "hijri" && gregorianText && <p className="text-xs text-muted-foreground">{gregorianText}</p>}
      {hijriIncomplete && <p className="text-xs text-destructive">تاريخ هجري غير صحيح — تحقق من اليوم والشهر والسنة</p>}
    </div>
  );
}

function ContactsRepeater({ initial }: { initial: BuildingContactValue[] }) {
  const [rows, setRows] = useState<BuildingContactValue[]>(initial.length > 0 ? initial : []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>بيانات التواصل</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((r) => [...r, { name: "", role: "", phone: "", note: "" }])}
        >
          <Plus className="size-4" />
          إضافة جهة اتصال
        </Button>
      </div>

      {rows.length === 0 && <p className="text-xs text-muted-foreground">لا توجد جهات اتصال مضافة</p>}

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Input
            name="contactName"
            placeholder="الاسم"
            defaultValue={row.name}
            onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
          />
          <Input name="contactRole" placeholder="الصفة" defaultValue={row.role ?? ""} />
          <Input name="contactPhone" placeholder="الهاتف" dir="ltr" defaultValue={row.phone ?? ""} />
          <Input name="contactNote" placeholder="ملاحظة" defaultValue={row.note ?? ""} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function MetersRepeater({ initial }: { initial: BuildingMeterValue[] }) {
  const [rows, setRows] = useState<BuildingMeterValue[]>(initial);

  function addRow(type: "ELECTRICITY" | "WATER") {
    setRows((r) => [...r, { type, meterNumber: "", subscriptionNumber: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>العدادات</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addRow("ELECTRICITY")}>
            <Plus className="size-4" />
            عداد كهرباء
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addRow("WATER")}>
            <Plus className="size-4" />
            عداد مياه
          </Button>
        </div>
      </div>

      {rows.length === 0 && <p className="text-xs text-muted-foreground">لا توجد عدادات مضافة</p>}

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr_auto]">
          <select
            name="meterType"
            defaultValue={row.type}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="ELECTRICITY">كهرباء</option>
            <option value="WATER">مياه</option>
          </select>
          <Input name="meterNumber" placeholder="رقم العداد" dir="ltr" defaultValue={row.meterNumber ?? ""} />
          <Input name="meterSubscriptionNumber" placeholder="رقم الاشتراك" dir="ltr" defaultValue={row.subscriptionNumber ?? ""} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function BuildingFields({ owners, building }: { owners: Owner[]; building?: BuildingFormValues }) {
  const [showOptional, setShowOptional] = useState(false);
  const [ownersList, setOwnersList] = useState(owners);
  const [selectedOwnerId, setSelectedOwnerId] = useState(building?.ownerId ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    building?.latitude && building?.longitude ? { lat: building.latitude, lng: building.longitude } : null
  );

  function handleLocationResolved({
    lat,
    lng,
    address,
    displayName,
  }: {
    lat: number;
    lng: number;
    address: Record<string, string>;
    displayName?: string;
  }) {
    setCoords({ lat, lng });
    setShowOptional(true);

    const setDomValue = (id: string, value?: string) => {
      if (!value) return;
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = value;
    };

    setDomValue("address", displayName);
    setDomValue("city", address.city || address.town || address.village || address.municipality);
    setDomValue("district", address.suburb || address.neighbourhood || address.quarter);
    requestAnimationFrame(() => setDomValue("streetName", address.road));
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm font-semibold">تفاصيل العقار</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              اسم العقار باللغة العربية<span className="text-destructive"> *</span>
            </Label>
            <Input id="name" name="name" required defaultValue={building?.name} />
          </div>
          <LabeledSelect label="قطاع العقار" name="sector" options={SECTOR_OPTIONS} defaultValue={building?.sector} required />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ownerId">
              مالك العقار<span className="text-destructive"> *</span>
            </Label>
            <div className="flex gap-2">
              <AddOwnerInlineDialog
                onCreated={(owner) => {
                  setOwnersList((list) => [...list, owner]);
                  setSelectedOwnerId(owner.id);
                }}
              />
              <Select value={selectedOwnerId} onValueChange={(v) => v && setSelectedOwnerId(v)} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المالك">
                    {ownersList.find((o) => o.id === selectedOwnerId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ownersList.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="ownerId" value={selectedOwnerId} />
            </div>
          </div>
          <LabeledSelect label="المنطقة" name="region" options={REGIONS} defaultValue={building?.region} required />
          <div className="space-y-1.5">
            <Label htmlFor="city">
              المدينة<span className="text-destructive"> *</span>
            </Label>
            <Input id="city" name="city" required defaultValue={building?.city ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="district">
              الحي<span className="text-destructive"> *</span>
            </Label>
            <Input id="district" name="district" required defaultValue={building?.district ?? ""} />
          </div>
        </div>

        {/* نسبة إدارة الأملاك تُدخل في اتفاقية الإدارة، لا هنا — مصدر واحد للنسبة. */}

        <div className="space-y-1.5">
          <Label htmlFor="address">العنوان التفصيلي</Label>
          <Input id="address" name="address" defaultValue={building?.address ?? ""} />
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold">صك الملكية</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LabeledSelect label="نوع الصك" name="deedType" options={DEED_TYPE_OPTIONS} defaultValue={building?.deedType} />
            <div className="space-y-1.5">
              <Label htmlFor="deedNumber">رقم الصك</Label>
              <Input id="deedNumber" name="deedNumber" dir="ltr" defaultValue={building?.deedNumber ?? ""} />
            </div>
            <DeedIssueDateField defaultValue={building?.deedIssueDate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deedFile" className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" />
              ملف صك الملكية (PDF أو صورة)
            </Label>
            <Input id="deedFile" name="deedFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
            {building?.deedFileUrl && (
              <a
                href={`/api/files/${building.deedFileUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-primary hover:underline"
              >
                عرض الملف الحالي
              </a>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="photos" className="flex items-center gap-1.5">
            <ImageIcon className="size-3.5" />
            صور العقار (اختياري)
          </Label>
          <Input id="photos" name="photos" type="file" accept=".png,.jpg,.jpeg,.webp" multiple />
          <p className="text-xs text-muted-foreground">
            يمكنك اختيار أكثر من صورة معاً — الواجهة، المدخل، المواقف. تُضاف إلى المعرض دون حذف الصور السابقة،
            وتُدار من صفحة العقار.
          </p>
        </div>

        <LocationMapPicker
          initialLat={building?.latitude}
          initialLng={building?.longitude}
          onResolved={handleLocationResolved}
        />
        <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
        <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      </div>

      <div className="border-t pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowOptional((v) => !v)}>
          {showOptional ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {showOptional ? "إخفاء المدخلات الاختيارية" : "إظهار المدخلات الاختيارية"}
        </Button>
      </div>

      {showOptional && (
        <div className="space-y-6 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-3">
            <p className="text-sm font-semibold">تفاصيل إضافية</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledSelect label="نوع العقار" name="propertyType" options={PROPERTY_TYPE_OPTIONS} defaultValue={building?.propertyType} />
              <div className="space-y-1.5">
                <Label htmlFor="propertyNumber">رقم العقار</Label>
                <Input id="propertyNumber" name="propertyNumber" defaultValue={building?.propertyNumber ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nameEn">اسم العقار باللغة الإنجليزية</Label>
                <Input id="nameEn" name="nameEn" dir="ltr" defaultValue={building?.nameEn ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complexName">المجمع</Label>
                <Input id="complexName" name="complexName" defaultValue={building?.complexName ?? ""} />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">صك الملكية</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <LabeledSelect label="نوع الصك" name="deedType" options={DEED_TYPE_OPTIONS} defaultValue={building?.deedType} />
              <div className="space-y-1.5">
                <Label htmlFor="deedNumber">رقم الصك</Label>
                <Input id="deedNumber" name="deedNumber" dir="ltr" defaultValue={building?.deedNumber ?? ""} />
              </div>
              <DeedIssueDateField defaultValue={building?.deedIssueDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deedFile" className="flex items-center gap-1.5">
                <Paperclip className="size-3.5" />
                ملف صك الملكية (PDF أو صورة)
              </Label>
              <Input id="deedFile" name="deedFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
              {building?.deedFileUrl && (
                <a
                  href={`/api/files/${building.deedFileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-primary hover:underline"
                >
                  عرض الملف الحالي
                </a>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">تفاصيل إنشائية</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="areaSqm">مساحة العقار (م²)</Label>
                <Input id="areaSqm" name="areaSqm" type="number" step="0.01" defaultValue={building?.areaSqm ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="constructionDate">تاريخ بناء العقار</Label>
                <Input
                  id="constructionDate"
                  name="constructionDate"
                  type="date"
                  defaultValue={toDateInputValue(building?.constructionDate)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="additionalNumber">الرقم الإضافي</Label>
                <Input id="additionalNumber" name="additionalNumber" dir="ltr" defaultValue={building?.additionalNumber ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="floorsCount">عدد الطوابق</Label>
                <Input id="floorsCount" name="floorsCount" type="number" defaultValue={building?.floorsCount ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitsPerFloor">عدد الوحدات في كل طابق</Label>
                <Input id="unitsPerFloor" name="unitsPerFloor" type="number" defaultValue={building?.unitsPerFloor ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plotNumber">رقم قطعة العقار</Label>
                <Input id="plotNumber" name="plotNumber" dir="ltr" defaultValue={building?.plotNumber ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5 sm:w-1/3">
              <Label htmlFor="blockNumber">رقم بلوك العقار</Label>
              <Input id="blockNumber" name="blockNumber" dir="ltr" defaultValue={building?.blockNumber ?? ""} />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">وصف العقار ومحتوياته</p>
            <div className="space-y-1.5">
              <Label htmlFor="description">وصف العقار</Label>
              <Textarea id="description" name="description" placeholder="وصف عام للعقار ومحتوياته" defaultValue={building?.description ?? ""} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="shopsCount">عدد المحلات</Label>
                <Input id="shopsCount" name="shopsCount" type="number" defaultValue={building?.shopsCount ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apartmentsCount">عدد الشقق</Label>
                <Input id="apartmentsCount" name="apartmentsCount" type="number" defaultValue={building?.apartmentsCount ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="elevatorsCount">عدد المصاعد</Label>
                <Input id="elevatorsCount" name="elevatorsCount" type="number" defaultValue={building?.elevatorsCount ?? ""} />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <MetersRepeater initial={building?.meters ?? []} />
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">العنوان الوطني</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="streetName">اسم الشارع</Label>
                <Input id="streetName" name="streetName" defaultValue={building?.streetName ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">الرمز البريدي</Label>
                <Input id="postalCode" name="postalCode" dir="ltr" defaultValue={building?.postalCode ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buildingNumber">رقم المبنى</Label>
                <Input id="buildingNumber" name="buildingNumber" dir="ltr" defaultValue={building?.buildingNumber ?? ""} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <ContactsRepeater initial={building?.contacts ?? []} />
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" name="notes" defaultValue={building?.notes ?? ""} />
          </div>
        </div>
      )}
    </>
  );
}
