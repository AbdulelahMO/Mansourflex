"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TermFields } from "@/components/shared/term-fields";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/lib/format";
import { Paperclip } from "lucide-react";

export type AgreementBuildingOption = { id: string; name: string; ownerId: string };

export type AgreementLineValue = {
  buildingId: string;
  commissionPercent: number;
};

export type AgreementValues = {
  ownerId: string;
  settlementFrequency?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  status: string;
  signedAt?: string | Date | null;
  signedPlace?: string | null;
  fileUrl?: string | null;
  terms?: string | null;
  duties?: string | null;
  notes?: string | null;
  otherAuthorities?: string | null;
  canSignContracts: boolean;
  canCollectRent: boolean;
  canMaintain: boolean;
  maintenanceLimit?: number | null;
  canLitigate: boolean;
  canNegotiateRenewal: boolean;
  lines: AgreementLineValue[];
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "سارية" },
  { value: "EXPIRED", label: "منتهية" },
  { value: "TERMINATED", label: "مفسوخة" },
];

export const SETTLEMENT_FREQUENCIES = [
  { value: "PER_COLLECTION", label: "مع كل تحصيل — تُخصم الأتعاب ويُورَّد الصافي" },
  { value: "MONTHLY", label: "شهرياً" },
  { value: "QUARTERLY", label: "ربع سنوي" },
  { value: "SEMI_ANNUAL", label: "نصف سنوي" },
  { value: "ANNUAL", label: "سنوياً" },
  { value: "ON_DEMAND", label: "عند الطلب أو الاتفاق" },
] as const;

const AUTHORITIES = [
  { name: "canSignContracts", label: "توقيع عقود الإيجار نيابة عن المالك" },
  { name: "canCollectRent", label: "تحصيل الإيجارات نيابة عن المالك" },
  { name: "canMaintain", label: "تنفيذ أعمال الصيانة" },
  { name: "canLitigate", label: "رفع الدعاوى والإخلاء عبر ناجز" },
  { name: "canNegotiateRenewal", label: "التفاوض على قيمة الإيجار والتجديد" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

export function AgreementFields({
  owners,
  buildings,
  agreement,
}: {
  owners: { id: string; name: string }[];
  buildings: AgreementBuildingOption[];
  agreement?: AgreementValues;
}) {
  // A new agreement is active by definition and has nothing signed yet — both belong to editing.
  const isEdit = !!agreement;
  const [ownerId, setOwnerId] = useState(agreement?.ownerId ?? "");
  const [canMaintain, setCanMaintain] = useState(agreement?.canMaintain ?? false);

  const currentLine = agreement?.lines?.[0];
  const [buildingId, setBuildingId] = useState(currentLine?.buildingId ?? "");

  // Only the chosen owner's buildings can be covered by their agreement.
  const ownerBuildings = buildings.filter((b) => b.ownerId === ownerId);

  return (
    <div className="space-y-4">
      <Section title="بيانات الاتفاقية">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ownerId">
              المالك <span className="text-destructive">*</span>
            </Label>
            <select
              id="ownerId"
              name="ownerId"
              required
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value);
                setBuildingId(""); // the building belongs to the previous owner
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">اختر المالك</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          {isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="status">حالة الاتفاقية</Label>
              <select
                id="status"
                name="status"
                defaultValue={agreement?.status ?? "ACTIVE"}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="status" value="ACTIVE" />
          )}
          <TermFields
            startLabel="تاريخ بداية الاتفاقية"
            endLabel="تاريخ نهاية الاتفاقية"
            defaultStart={toDateInputValue(agreement?.startDate)}
            defaultEnd={toDateInputValue(agreement?.endDate)}
          />
          {/* التوقيع قد يسبق بداية السريان، فيُسجَّل مستقلاً ويظهر في صدر الوثيقة. */}
          <div className="space-y-1.5">
            <Label htmlFor="signedAt">تاريخ التوقيع</Label>
            <Input id="signedAt" name="signedAt" type="date" defaultValue={toDateInputValue(agreement?.signedAt)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signedPlace">مكان التوقيع</Label>
            <Input id="signedPlace" name="signedPlace" defaultValue={agreement?.signedPlace ?? ""} placeholder="مثال: الرياض" />
          </div>
        </div>
      </Section>

      {/* Each agreement covers exactly one building, so withdrawing a property is a clean
          termination of its own agreement rather than an edit that erases history. */}
      <Section title="المبنى ونسبة العمولة (% من صافي المحصّل بعد المصروفات)">
        {!ownerId ? (
          <p className="text-sm text-muted-foreground">اختر المالك أولاً لعرض مبانيه.</p>
        ) : ownerBuildings.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مبانٍ مسجّلة لهذا المالك.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor="lineBuildingId">
                المبنى <span className="text-destructive">*</span>
              </Label>
              <select
                id="lineBuildingId"
                name="lineBuildingId"
                required
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">اختر المبنى</option>
                {ownerBuildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commissionPercent">
                النسبة % <span className="text-destructive">*</span>
              </Label>
              <Input
                id="commissionPercent"
                name="commissionPercent"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                required
                defaultValue={currentLine?.commissionPercent || ""}
                placeholder="مثال: 5"
              />
              <p className="text-xs text-muted-foreground">
                لا تُقبل نسبة صفرية — المبنى الذي يديره مالكه بنفسه لا يحتاج اتفاقية.
              </p>
            </div>
          </div>
        )}

        {/* When the parties settle up is a clause they agree on, not a system preference: some
            owners take the net of every collection, others reckon once every six months. */}
        <div className="space-y-1.5">
          <Label htmlFor="settlementFrequency">دورية التسوية والتوريد</Label>
          <select
            id="settlementFrequency"
            name="settlementFrequency"
            defaultValue={agreement?.settlementFrequency ?? "PER_COLLECTION"}
            className="h-11 w-full rounded-lg border md:h-9 border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          >
            {SETTLEMENT_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            متى تُخصم أتعاب الإدارة ويُورَّد للمالك نصيبه. تُطبع في الاتفاقية لأنها بند متفق عليه.
          </p>
        </div>
      </Section>

      <Section title="الصلاحيات الممنوحة لمدير الأملاك">
        <div className="space-y-2">
          {AUTHORITIES.map((a) => (
            <label key={a.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={a.name}
                defaultChecked={agreement?.[a.name] ?? false}
                onChange={a.name === "canMaintain" ? (e) => setCanMaintain(e.target.checked) : undefined}
                className="size-4 accent-primary"
              />
              {a.label}
            </label>
          ))}
        </div>
        {canMaintain && (
          <div className="space-y-1.5">
            <Label htmlFor="maintenanceLimit">حد الصيانة دون الرجوع للمالك (ر.س.)</Label>
            <Input
              id="maintenanceLimit"
              name="maintenanceLimit"
              type="number"
              step="0.01"
              min="0"
              defaultValue={agreement?.maintenanceLimit ?? ""}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="otherAuthorities">صلاحيات أخرى</Label>
          <Textarea id="otherAuthorities" name="otherAuthorities" defaultValue={agreement?.otherAuthorities ?? ""} />
        </div>
      </Section>

      <Section title="الشروط والواجبات">
        <div className="space-y-1.5">
          <Label htmlFor="terms">شروط الاتفاقية</Label>
          <Textarea id="terms" name="terms" rows={4} defaultValue={agreement?.terms ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duties">واجبات مدير الأملاك</Label>
          <Textarea id="duties" name="duties" rows={4} defaultValue={agreement?.duties ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">ملاحظات</Label>
          <Textarea id="notes" name="notes" defaultValue={agreement?.notes ?? ""} />
        </div>
      </Section>

      {isEdit && (
        <Section title="النسخة الموقّعة">
          <div className="space-y-1.5">
            <Label htmlFor="agreementFile" className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" />
              ملف الاتفاقية الموقّعة (PDF أو صورة)
            </Label>
            <Input id="agreementFile" name="agreementFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
            <p className="text-xs text-muted-foreground">
              اطبع صيغة الاتفاقية ووقّعها مع المالك، ثم ارفع النسخة الموقّعة هنا.
            </p>
            {agreement?.fileUrl && (
              <a
                href={`/api/files/${agreement.fileUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-primary hover:underline"
              >
                عرض الملف الحالي
              </a>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
