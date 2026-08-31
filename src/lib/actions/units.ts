"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { buildUnitNumbers } from "@/lib/unit-numbering";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const unitSchema = z.object({
  buildingId: z.string().trim().min(1, "اختر المبنى"),
  unitNumber: z.string().trim().min(1, "رقم الوحدة مطلوب"),
  floor: z.string().trim().optional().or(z.literal("")),
  unitType: z.string().trim().optional().or(z.literal("")),
  areaSqm: z.string().trim().optional().or(z.literal("")),
  bedrooms: z.string().trim().optional().or(z.literal("")),
  bathrooms: z.string().trim().optional().or(z.literal("")),
  rentAmount: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["VACANT", "OCCUPIED", "MAINTENANCE"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

function toFloat(v?: string) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toInt(v?: string) {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function createUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("units.create");

  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.unit.findUnique({
    where: { buildingId_unitNumber: { buildingId: data.buildingId, unitNumber: data.unitNumber } },
  });
  if (existing) return { error: "رقم الوحدة موجود مسبقاً في هذا المبنى" };

  await prisma.unit.create({
    data: {
      buildingId: data.buildingId,
      unitNumber: data.unitNumber,
      floor: data.floor || null,
      unitType: data.unitType || null,
      areaSqm: toFloat(data.areaSqm),
      bedrooms: toInt(data.bedrooms),
      bathrooms: toInt(data.bathrooms),
      rentAmount: toFloat(data.rentAmount),
      status: data.status,
      notes: data.notes || null,
    },
  });

  revalidatePath("/units");
  revalidatePath(`/buildings/${data.buildingId}`);
  return { success: true };
}

export async function updateUnit(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("units.edit");

  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Renaming onto a number the building already carries would surface as a raw constraint error.
  const taken = await prisma.unit.findFirst({
    where: { buildingId: data.buildingId, unitNumber: data.unitNumber, id: { not: id } },
    select: { id: true },
  });
  if (taken) return { error: "رقم الوحدة موجود مسبقاً في هذا المبنى" };

  await prisma.unit.update({
    where: { id },
    data: {
      unitNumber: data.unitNumber,
      floor: data.floor || null,
      unitType: data.unitType || null,
      areaSqm: toFloat(data.areaSqm),
      bedrooms: toInt(data.bedrooms),
      bathrooms: toInt(data.bathrooms),
      rentAmount: toFloat(data.rentAmount),
      status: data.status,
      notes: data.notes || null,
    },
  });

  revalidatePath("/units");
  revalidatePath(`/buildings/${data.buildingId}`);
  return { success: true };
}

export async function deleteUnit(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("units.delete", { id }, reason);
}

const bulkSchema = z.object({
  buildingId: z.string().trim().min(1, "اختر المبنى"),
  mode: z.enum(["floors", "sequential"]),
  floors: z.string().optional(),
  perFloor: z.string().optional(),
  firstFloor: z.string().optional(),
  count: z.string().optional(),
  startFrom: z.string().optional(),
  prefix: z.string().optional(),
  unitType: z.string().trim().optional().or(z.literal("")),
  areaSqm: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  rentAmount: z.string().optional(),
  status: z.enum(["VACANT", "MAINTENANCE"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Creates a floor's worth of units at once, or a numbered run of them.
 *
 * A building of twenty flats meant filling the same form twenty times, differing only in the
 * number on the door. The shared attributes are written once and copied; whatever differs — the
 * larger corner flat, the shop on the ground floor — is corrected afterwards on the one unit it
 * belongs to, which is far less work than typing all twenty by hand.
 *
 * A number the building already carries is skipped rather than failing the batch: re-running
 * after adding a floor should add the floor, not refuse because the first one exists.
 */
export async function createUnitsBulk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("units.create");

  const parsed = bulkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const planned = buildUnitNumbers({
    mode: d.mode,
    floors: Number(d.floors || 0),
    perFloor: Number(d.perFloor || 0),
    firstFloor: d.firstFloor === "" || d.firstFloor === undefined ? 1 : Number(d.firstFloor),
    count: Number(d.count || 0),
    startFrom: d.startFrom === "" || d.startFrom === undefined ? 1 : Number(d.startFrom),
    prefix: d.prefix,
  });

  if (planned.length === 0) return { error: "لم يُنتج هذا الإدخال أي وحدة — راجع الأعداد" };

  const building = await prisma.building.findUnique({ where: { id: d.buildingId }, select: { name: true } });
  if (!building) return { error: "المبنى غير موجود" };

  const existing = new Set(
    (await prisma.unit.findMany({ where: { buildingId: d.buildingId }, select: { unitNumber: true } })).map(
      (u) => u.unitNumber
    )
  );
  const fresh = planned.filter((u) => !existing.has(u.unitNumber));
  const skipped = planned.length - fresh.length;

  if (fresh.length === 0) {
    return { error: `كل الأرقام المطلوبة (${planned.length}) موجودة في ${building.name} — لم تُضف وحدة` };
  }

  await prisma.unit.createMany({
    data: fresh.map((u) => ({
      buildingId: d.buildingId,
      unitNumber: u.unitNumber,
      floor: u.floor,
      unitType: d.unitType || null,
      areaSqm: toFloat(d.areaSqm),
      bedrooms: toInt(d.bedrooms),
      bathrooms: toInt(d.bathrooms),
      rentAmount: toFloat(d.rentAmount),
      status: d.status,
      notes: d.notes || null,
    })),
  });

  await recordAudit({
    user,
    action: "units.create",
    summary: `إضافة ${fresh.length} وحدة دفعة واحدة إلى ${building.name} (${fresh[0].unitNumber}–${fresh[fresh.length - 1].unitNumber})`,
    targetId: d.buildingId,
  });

  revalidatePath("/units");
  revalidatePath(`/buildings/${d.buildingId}`);
  return {
    success: true,
    message: `أُضيفت ${fresh.length} وحدة${skipped ? ` — وتُخطّيت ${skipped} لوجود أرقامها` : ""}`,
  };
}
