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
  agreementPreamble: z.string().trim().optional().or(z.literal("")),
  agreementClosing: z.string().trim().optional().or(z.literal("")),
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
      agreementPreamble: data.agreementPreamble || null,
      agreementClosing: data.agreementClosing || null,
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
      agreementPreamble: data.agreementPreamble || null,
      agreementClosing: data.agreementClosing || null,
      ...(logoUrl ? { logoUrl } : {}),
    },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/documents", "layout");
  revalidatePath("/agreements", "layout");
  return { success: true, message: "تم حفظ بيانات المنشأة" };
}
