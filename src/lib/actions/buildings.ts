"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/uploads";
import { runSensitive } from "@/lib/approvals";
import { requirePermission, recordAudit } from "@/lib/authz";
import { buildingClosure, duesSummary } from "@/lib/core/building-closure";
import type { ActionState } from "@/lib/types";

const optionalText = () => z.string().trim().optional().or(z.literal(""));

const buildingSchema = z.object({
  name: z.string().trim().min(2, "اسم العقار مطلوب"),
  nameEn: optionalText(),
  ownerId: z.string().trim().min(1, "اختر المالك"),
  sector: z.string().trim().min(1, "اختر قطاع العقار"),
  region: z.string().trim().min(1, "اختر المنطقة"),
  city: z.string().trim().min(1, "المدينة مطلوبة"),
  district: z.string().trim().min(1, "الحي مطلوب"),
  address: optionalText(),
  notes: optionalText(),

  usageType: optionalText(),
  propertyType: optionalText(),
  propertyNumber: optionalText(),
  complexName: optionalText(),

  streetName: optionalText(),
  postalCode: optionalText(),
  buildingNumber: optionalText(),
  additionalNumber: optionalText(),
  plotNumber: optionalText(),
  blockNumber: optionalText(),

  deedType: optionalText(),
  deedNumber: optionalText(),
  deedIssueDate: optionalText(),

  areaSqm: optionalText(),
  constructionDate: optionalText(),
  floorsCount: optionalText(),
  unitsPerFloor: optionalText(),

  description: optionalText(),
  shopsCount: optionalText(),
  apartmentsCount: optionalText(),
  elevatorsCount: optionalText(),

  latitude: optionalText(),
  longitude: optionalText(),
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
function toDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseContacts(formData: FormData) {
  const names = formData.getAll("contactName") as string[];
  const roles = formData.getAll("contactRole") as string[];
  const phones = formData.getAll("contactPhone") as string[];
  const notes = formData.getAll("contactNote") as string[];

  return names
    .map((name, i) => ({
      name: name?.trim() ?? "",
      role: roles[i]?.trim() || null,
      phone: phones[i]?.trim() || null,
      note: notes[i]?.trim() || null,
    }))
    .filter((c) => c.name.length > 0);
}

function parseMeters(formData: FormData) {
  const types = formData.getAll("meterType") as string[];
  const numbers = formData.getAll("meterNumber") as string[];
  const subscriptions = formData.getAll("meterSubscriptionNumber") as string[];

  return types
    .map((type, i) => ({
      type: type === "WATER" ? ("WATER" as const) : ("ELECTRICITY" as const),
      meterNumber: numbers[i]?.trim() || null,
      subscriptionNumber: subscriptions[i]?.trim() || null,
    }))
    .filter((m) => m.meterNumber || m.subscriptionNumber);
}

async function buildData(formData: FormData) {
  const parsed = buildingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, state: { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors } } as const;
  }
  const data = parsed.data;

  let deedFileUrl: string | undefined;
  const deedFile = formData.get("deedFile");
  if (deedFile instanceof File && deedFile.size > 0) {
    try {
      deedFileUrl = await saveUploadedFile(deedFile, "deeds");
    } catch (err) {
      return { ok: false, state: { error: err instanceof Error ? err.message : "تعذر رفع الملف" } } as const;
    }
  }

  // Photos are optional and may arrive several at a time; a failed one aborts rather than
  // silently dropping a file the user believed was attached.
  const photos: { url: string }[] = [];
  for (const entry of formData.getAll("photos")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    try {
      photos.push({ url: await saveUploadedFile(entry, "buildings") });
    } catch (err) {
      return { ok: false, state: { error: err instanceof Error ? err.message : "تعذر رفع الصورة" } } as const;
    }
  }

  return {
    ok: true as const,
    photos,
    values: {
      name: data.name,
      nameEn: data.nameEn || null,
      ownerId: data.ownerId,
      sector: data.sector,
      region: data.region,
      city: data.city,
      district: data.district,
      address: data.address || null,
      notes: data.notes || null,
      usageType: data.usageType || null,
      propertyType: data.propertyType || null,
      propertyNumber: data.propertyNumber || null,
      complexName: data.complexName || null,
      streetName: data.streetName || null,
      postalCode: data.postalCode || null,
      buildingNumber: data.buildingNumber || null,
      additionalNumber: data.additionalNumber || null,
      plotNumber: data.plotNumber || null,
      blockNumber: data.blockNumber || null,
      deedType: data.deedType || null,
      deedNumber: data.deedNumber || null,
      deedIssueDate: toDate(data.deedIssueDate),
      areaSqm: toFloat(data.areaSqm),
      constructionDate: toDate(data.constructionDate),
      floorsCount: toInt(data.floorsCount),
      unitsPerFloor: toInt(data.unitsPerFloor),
      description: data.description || null,
      shopsCount: toInt(data.shopsCount),
      apartmentsCount: toInt(data.apartmentsCount),
      elevatorsCount: toInt(data.elevatorsCount),
      latitude: toFloat(data.latitude),
      longitude: toFloat(data.longitude),
      ...(deedFileUrl ? { deedFileUrl } : {}),
    },
    contacts: parseContacts(formData),
    meters: parseMeters(formData),
  };
}

export async function createBuilding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("buildings.create");

  const result = await buildData(formData);
  if (!result.ok) return result.state;

  await prisma.building.create({
    data: {
      ...result.values,
      contacts: { create: result.contacts },
      meters: { create: result.meters },
      photos: { create: result.photos },
    },
  });

  revalidatePath("/buildings");
  redirect("/buildings");
}

export async function updateBuilding(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("buildings.edit");

  const result = await buildData(formData);
  if (!result.ok) return result.state;

  // Newly attached photos are added to the gallery; existing ones are managed from the building page.
  await prisma.$transaction([
    prisma.buildingContact.deleteMany({ where: { buildingId: id } }),
    prisma.buildingMeter.deleteMany({ where: { buildingId: id } }),
    prisma.building.update({
      where: { id },
      data: {
        ...result.values,
        contacts: { create: result.contacts },
        meters: { create: result.meters },
        photos: { create: result.photos },
      },
    }),
  ]);

  revalidatePath("/buildings");
  revalidatePath(`/buildings/${id}`);
  redirect(`/buildings/${id}`);
}

export async function deleteBuilding(
  id: string,
  reason?: string,
  acknowledged?: boolean
): Promise<ActionState> {
  // Money still open on the building is surfaced before anything else, whoever is asking.
  const closure = await buildingClosure(id);
  if (closure?.hasDues && !acknowledged) {
    return {
      error: `على وحدات هذا المبنى مستحقات قائمة: ${duesSummary(closure)}. الأصل تصفيتها قبل الحذف — أكّد المتابعة إن كنت تريد رفع الطلب رغم ذلك.`,
      needsAcknowledge: true,
    };
  }

  const result = await runSensitive("buildings.delete", { id, acknowledged: true }, reason);
  // A filed request keeps the page; an actual deletion has nothing left to show.
  if (result.success && !result.message?.includes("الطلب")) redirect("/buildings");
  return result;
}

/** Ends management of a property without erasing it: it leaves the working lists, records stay. */
export async function archiveBuilding(id: string): Promise<ActionState> {
  const { user } = await requirePermission("buildings.archive");

  const building = await prisma.building.findUnique({ where: { id }, select: { name: true, archivedAt: true } });
  if (!building) return { error: "المبنى غير موجود" };
  if (building.archivedAt) return { error: "المبنى مؤرشف بالفعل" };

  await prisma.building.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({ user, action: "buildings.archive", summary: `أرشفة المبنى «${building.name}»`, targetId: id });

  revalidatePath("/buildings");
  revalidatePath(`/buildings/${id}`);
  return { success: true, message: "تمت أرشفة المبنى" };
}

export async function unarchiveBuilding(id: string): Promise<ActionState> {
  const { user } = await requirePermission("buildings.archive");

  const building = await prisma.building.findUnique({ where: { id }, select: { name: true } });
  if (!building) return { error: "المبنى غير موجود" };

  await prisma.building.update({ where: { id }, data: { archivedAt: null } });
  await recordAudit({ user, action: "buildings.archive", summary: `إعادة المبنى «${building.name}» من الأرشيف`, targetId: id });

  revalidatePath("/buildings");
  revalidatePath(`/buildings/${id}`);
  return { success: true, message: "أُعيد المبنى للقوائم العاملة" };
}

/** Removes one photo from the gallery. */
export async function deleteBuildingPhoto(id: string): Promise<ActionState> {
  await requirePermission("buildings.edit");

  const photo = await prisma.buildingPhoto.findUnique({ where: { id } });
  if (!photo) return { error: "الصورة غير موجودة" };

  await prisma.buildingPhoto.delete({ where: { id } });

  revalidatePath(`/buildings/${photo.buildingId}`);
  return { success: true };
}

export async function updateBuildingPhotoCaption(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("buildings.edit");

  const photo = await prisma.buildingPhoto.findUnique({ where: { id } });
  if (!photo) return { error: "الصورة غير موجودة" };

  const caption = String(formData.get("caption") ?? "").trim();
  await prisma.buildingPhoto.update({ where: { id }, data: { caption: caption || null } });

  revalidatePath(`/buildings/${photo.buildingId}`);
  return { success: true, message: "تم حفظ الوصف" };
}
