"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { saveUploadedFile } from "@/lib/uploads";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

/** Stores the signed copy if one was attached; returns undefined so the field is left untouched otherwise. */
async function saveSignedCopy(formData: FormData) {
  const file = formData.get("agreementFile");
  if (!(file instanceof File) || file.size === 0) return { url: undefined };
  try {
    return { url: await saveUploadedFile(file, "agreements") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذر رفع الملف" };
  }
}

const lineSchema = z.object({
  buildingId: z.string().min(1),
  // A management agreement always carries a fee; a building the owner runs himself needs no agreement.
  commissionPercent: z
    .number()
    .gt(0, "نسبة الإدارة مطلوبة ولا يمكن أن تكون صفراً")
    .max(100, "نسبة الإدارة لا تتجاوز 100%"),
});

const agreementSchema = z.object({
  ownerId: z.string().min(1, "المالك مطلوب"),
  startDate: z.string().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().min(1, "تاريخ النهاية مطلوب"),
  status: z.enum(["ACTIVE", "EXPIRED", "TERMINATED"]),
  settlementFrequency: z.enum(["PER_COLLECTION", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "ON_DEMAND"]),
  signedAt: z.string().optional(),
  signedPlace: z.string().optional(),
  terms: z.string().optional(),
  duties: z.string().optional(),
  notes: z.string().optional(),
  otherAuthorities: z.string().optional(),
  canSignContracts: z.boolean(),
  canCollectRent: z.boolean(),
  canMaintain: z.boolean(),
  maintenanceLimit: z.number().nullable(),
  canLitigate: z.boolean(),
  canNegotiateRenewal: z.boolean(),
  lines: z.array(lineSchema).length(1, "اختر المبنى المشمول بالاتفاقية"),
});

/** Next agreement number for the year, derived from the highest already issued. */
async function nextAgreementNumber() {
  const year = new Date().getFullYear();
  const scope = `AGR-${year}-`;
  const issued = await prisma.managementAgreement.findMany({
    where: { agreementNumber: { startsWith: scope } },
    select: { agreementNumber: true },
  });
  const highest = issued.reduce((max, a) => {
    const seq = Number(a.agreementNumber.slice(scope.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${scope}${String(highest + 1).padStart(4, "0")}`;
}

function parseForm(formData: FormData) {
  const bool = (name: string) => formData.get(name) === "on";
  const limitRaw = String(formData.get("maintenanceLimit") ?? "").trim();

  // An agreement covers exactly one building, so it carries a single commission line.
  const buildingId = String(formData.get("lineBuildingId") ?? "");
  const lines = buildingId
    ? [{ buildingId, commissionPercent: Number(formData.get("commissionPercent") ?? 0) }]
    : [];

  return agreementSchema.safeParse({
    ownerId: String(formData.get("ownerId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    status: (String(formData.get("status") || "ACTIVE") as "ACTIVE" | "EXPIRED" | "TERMINATED"),
    settlementFrequency: String(formData.get("settlementFrequency") || "PER_COLLECTION") as
      | "PER_COLLECTION"
      | "MONTHLY"
      | "QUARTERLY"
      | "SEMI_ANNUAL"
      | "ANNUAL"
      | "ON_DEMAND",
    signedAt: String(formData.get("signedAt") ?? ""),
    signedPlace: String(formData.get("signedPlace") ?? ""),
    terms: String(formData.get("terms") ?? ""),
    duties: String(formData.get("duties") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    otherAuthorities: String(formData.get("otherAuthorities") ?? ""),
    canSignContracts: bool("canSignContracts"),
    canCollectRent: bool("canCollectRent"),
    canMaintain: bool("canMaintain"),
    maintenanceLimit: limitRaw ? Number(limitRaw) : null,
    canLitigate: bool("canLitigate"),
    canNegotiateRenewal: bool("canNegotiateRenewal"),
    lines,
  });
}

/**
 * A building may sit under only one ACTIVE agreement at a time, otherwise its commission
 * would be ambiguous. Older/terminated agreements are kept as history.
 */
async function conflictingBuilding(buildingIds: string[], status: string, ignoreAgreementId?: string) {
  if (status !== "ACTIVE") return null;
  const clash = await prisma.agreementBuilding.findFirst({
    where: {
      buildingId: { in: buildingIds },
      agreement: {
        status: "ACTIVE",
        ...(ignoreAgreementId ? { id: { not: ignoreAgreementId } } : {}),
      },
    },
    include: { building: { select: { name: true } }, agreement: { select: { agreementNumber: true } } },
  });
  return clash ? `المبنى "${clash.building.name}" مشمول باتفاقية سارية أخرى (${clash.agreement.agreementNumber})` : null;
}

export async function createAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agreements.create");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "تحقق من الحقول" };
  }
  const d = parsed.data;

  const conflict = await conflictingBuilding(d.lines.map((l) => l.buildingId), d.status);
  if (conflict) return { error: conflict };

  const signed = await saveSignedCopy(formData);
  if (signed.error) return { error: signed.error };

  const created = await prisma.managementAgreement.create({
    data: {
      agreementNumber: await nextAgreementNumber(),
      ...(signed.url ? { fileUrl: signed.url } : {}),
      ownerId: d.ownerId,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      status: d.status,
      signedAt: d.signedAt ? new Date(d.signedAt) : null,
      signedPlace: d.signedPlace || null,
      settlementFrequency: d.settlementFrequency,
      terms: d.terms || null,
      duties: d.duties || null,
      notes: d.notes || null,
      otherAuthorities: d.otherAuthorities || null,
      canSignContracts: d.canSignContracts,
      canCollectRent: d.canCollectRent,
      canMaintain: d.canMaintain,
      maintenanceLimit: d.maintenanceLimit,
      canLitigate: d.canLitigate,
      canNegotiateRenewal: d.canNegotiateRenewal,
      buildings: { create: d.lines },
    },
  });

  revalidatePath("/agreements");
  redirect(`/agreements/${created.id}`);
}

export async function updateAgreement(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agreements.edit");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "تحقق من الحقول" };
  }
  const d = parsed.data;

  const conflict = await conflictingBuilding(d.lines.map((l) => l.buildingId), d.status, id);
  if (conflict) return { error: conflict };

  const signed = await saveSignedCopy(formData);
  if (signed.error) return { error: signed.error };

  await prisma.$transaction([
    prisma.agreementBuilding.deleteMany({ where: { agreementId: id } }),
    prisma.managementAgreement.update({
      where: { id },
      data: {
        // Only replace the stored copy when a new file was actually attached.
        ...(signed.url ? { fileUrl: signed.url } : {}),
        ownerId: d.ownerId,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        status: d.status,
      signedAt: d.signedAt ? new Date(d.signedAt) : null,
      signedPlace: d.signedPlace || null,
        settlementFrequency: d.settlementFrequency,
        terms: d.terms || null,
        duties: d.duties || null,
        notes: d.notes || null,
        otherAuthorities: d.otherAuthorities || null,
        canSignContracts: d.canSignContracts,
        canCollectRent: d.canCollectRent,
        canMaintain: d.canMaintain,
        maintenanceLimit: d.maintenanceLimit,
        canLitigate: d.canLitigate,
        canNegotiateRenewal: d.canNegotiateRenewal,
        buildings: { create: d.lines },
      },
    }),
  ]);

  revalidatePath("/agreements");
  revalidatePath(`/agreements/${id}`);
  redirect(`/agreements/${id}`);
}

/**
 * Closes the agreement: freezes the final account as a stored statement and marks the
 * agreement terminated. The figures are a snapshot — recording a back-dated payment or
 * expense afterwards never rewrites a settled account.
 */
export async function settleAndTerminateAgreement(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const settledAt = String(formData.get("settledAt") ?? "").trim();
  if (!settledAt) return { error: "تاريخ الإنهاء مطلوب" };

  return runSensitive(
    "agreements.settle",
    { id, settledAt, notes: String(formData.get("notes") ?? "").trim() },
    String(formData.get("reason") ?? "")
  );
}

/**
 * Undoes a settlement recorded by mistake: drops the frozen statement and puts the agreement
 * back in force with its original end date, so it can be settled again with correct figures.
 */
export async function cancelSettlement(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("agreements.cancelSettlement", { id }, reason);
}

export async function deleteAgreement(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("agreements.delete", { id }, reason);
}
