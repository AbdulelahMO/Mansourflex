"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import type { ActionState } from "@/lib/types";

const integrationSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب"),
  type: z.enum(["PAYMENT_GATEWAY", "SMS", "WHATSAPP", "EMAIL", "WEBHOOK", "OTHER"]),
  apiKey: z.string().trim().optional().or(z.literal("")),
  apiSecret: z.string().trim().optional().or(z.literal("")),
  endpointUrl: z.string().trim().optional().or(z.literal("")),
  isActive: z.string().optional(),
});

export async function createIntegration(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.integrations");

  const parsed = integrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  await prisma.integrationConfig.create({
    data: {
      name: data.name,
      type: data.type,
      apiKey: data.apiKey || null,
      apiSecret: data.apiSecret || null,
      endpointUrl: data.endpointUrl || null,
      isActive: data.isActive === "on",
    },
  });

  revalidatePath("/settings/integrations");
  return { success: true };
}

export async function updateIntegration(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.integrations");

  const parsed = integrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  await prisma.integrationConfig.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      apiKey: data.apiKey || null,
      apiSecret: data.apiSecret || null,
      endpointUrl: data.endpointUrl || null,
      isActive: data.isActive === "on",
    },
  });

  revalidatePath("/settings/integrations");
  return { success: true };
}

export async function toggleIntegration(id: string, isActive: boolean): Promise<ActionState> {
  await requirePermission("settings.integrations");
  await prisma.integrationConfig.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings/integrations");
  return { success: true };
}

export async function deleteIntegration(id: string): Promise<ActionState> {
  await requirePermission("settings.integrations");
  await prisma.integrationConfig.delete({ where: { id } });
  revalidatePath("/settings/integrations");
  return { success: true };
}
