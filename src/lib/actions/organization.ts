"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { requireUser } from "@/lib/session";
import { saveUploadedFile } from "@/lib/uploads";
import type { ActionState } from "@/lib/types";

const ORG_SETTINGS_ID = "default";

const organizationSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  commercialRegister: z.string().trim().optional().or(z.literal("")),
  taxNumber: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  nationalAddress: z.string().trim().optional().or(z.literal("")),
  signatoryName: z.string().trim().optional().or(z.literal("")),
  signatoryTitle: z.string().trim().optional().or(z.literal("")),
});

export async function getOrganizationSettings() {
  await requireUser();
  return prisma.organizationSettings.findUnique({ where: { id: ORG_SETTINGS_ID } });
}

export async function updateOrganizationSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.organization");

  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  let logoUrl: string | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logoUrl = await saveUploadedFile(logoFile, "logos");
    } catch (err) {
      return { error: err instanceof Error ? err.message : "تعذر رفع الشعار" };
    }
  }

  await prisma.organizationSettings.upsert({
    where: { id: ORG_SETTINGS_ID },
    create: {
      id: ORG_SETTINGS_ID,
      name: data.name || null,
      commercialRegister: data.commercialRegister || null,
      taxNumber: data.taxNumber || null,
      phone: data.phone || null,
      address: data.address || null,
      nationalAddress: data.nationalAddress || null,
      signatoryName: data.signatoryName || null,
      signatoryTitle: data.signatoryTitle || null,
      ...(logoUrl ? { logoUrl } : {}),
    },
    update: {
      name: data.name || null,
      commercialRegister: data.commercialRegister || null,
      taxNumber: data.taxNumber || null,
      phone: data.phone || null,
      address: data.address || null,
      nationalAddress: data.nationalAddress || null,
      signatoryName: data.signatoryName || null,
      signatoryTitle: data.signatoryTitle || null,
      ...(logoUrl ? { logoUrl } : {}),
    },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/documents", "layout");
  revalidatePath("/agreements", "layout");
  return { success: true, message: "تم حفظ بيانات المنشأة" };
}

/**
 * Saves the wording agreements are printed with, on its own.
 *
 * Kept apart from the organisation form: that form writes every field it carries, so a page that
 * shows only the identity fields would blank the agreement text every time it was saved.
 */
export async function updateAgreementText(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("agreements.edit");

  const preamble = String(formData.get("agreementPreamble") ?? "").trim();
  const closing = String(formData.get("agreementClosing") ?? "").trim();

  await prisma.organizationSettings.upsert({
    where: { id: ORG_SETTINGS_ID },
    create: { id: ORG_SETTINGS_ID, agreementPreamble: preamble || null, agreementClosing: closing || null },
    update: { agreementPreamble: preamble || null, agreementClosing: closing || null },
  });

  revalidatePath("/agreements");
  return { success: true, message: "حُفظت نصوص الاتفاقية" };
}
