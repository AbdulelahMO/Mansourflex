"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const ownerSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب"),
  ownerType: z.string().trim().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{10}$/.test(v), "رقم الجوال يجب أن يتكون من 10 أرقام"),
  email: z.string().trim().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  nationalId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{10}$/.test(v), "رقم الهوية يجب أن يتكون من 10 أرقام"),
  taxNumber: z.string().trim().optional().or(z.literal("")),
  unifiedNumber: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^700\d{7}$/.test(v), "الرقم الموحد يجب أن يبدأ بـ700 ويتكون من 10 أرقام"),
  representativeName: z.string().trim().optional().or(z.literal("")),
  representativeNationalId: z.string().trim().optional().or(z.literal("")),
  representativePhone: z.string().trim().optional().or(z.literal("")),
  representativeEmail: z.string().trim().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

async function createOwnerRecord(formData: FormData) {
  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, state: { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors } } as const;
  }
  const data = parsed.data;

  const owner = await prisma.owner.create({
    data: {
      name: data.name,
      ownerType: data.ownerType || null,
      phone: data.phone || null,
      email: data.email || null,
      nationalId: data.nationalId || null,
      taxNumber: data.taxNumber || null,
      unifiedNumber: data.unifiedNumber || null,
      representativeName: data.representativeName || null,
      representativeNationalId: data.representativeNationalId || null,
      representativePhone: data.representativePhone || null,
      representativeEmail: data.representativeEmail || null,
      notes: data.notes || null,
    },
  });

  return { ok: true as const, owner };
}

export async function createOwner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("owners.create");

  const result = await createOwnerRecord(formData);
  if (!result.ok) return result.state;

  revalidatePath("/owners");
  redirect("/owners");
}

export type OwnerActionState = ActionState & { owner?: { id: string; name: string } };

/** Same as createOwner but returns the created owner instead of redirecting, for inline "add owner" dialogs. */
export async function createOwnerInline(_prev: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  await requirePermission("owners.create");

  const result = await createOwnerRecord(formData);
  if (!result.ok) return result.state;

  return { success: true, owner: { id: result.owner.id, name: result.owner.name } };
}

export async function updateOwner(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("owners.edit");

  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  await prisma.owner.update({
    where: { id },
    data: {
      name: data.name,
      ownerType: data.ownerType || null,
      phone: data.phone || null,
      email: data.email || null,
      nationalId: data.nationalId || null,
      taxNumber: data.taxNumber || null,
      unifiedNumber: data.unifiedNumber || null,
      representativeName: data.representativeName || null,
      representativeNationalId: data.representativeNationalId || null,
      representativePhone: data.representativePhone || null,
      representativeEmail: data.representativeEmail || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/owners");
  redirect("/owners");
}

export async function deleteOwner(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("owners.delete", { id }, reason);
}
