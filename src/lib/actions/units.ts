"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
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
