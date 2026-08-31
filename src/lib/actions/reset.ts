"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/authz";
import { UPLOADS_ROOT } from "@/lib/paths";
import { RESET_PHRASE } from "@/lib/reset-phrase";
import type { ActionState } from "@/lib/types";

/**
 * Empties the system of its working data and leaves its shape standing: the organisation, the
 * roles and their permissions, the staff accounts, and the audit log — which keeps the record
 * that this happened at all.
 *
 * There is no undo. The screen makes the operator download a backup before the button becomes
 * live, so the file is in their hands before anything is deleted; this action only refuses to
 * proceed without the phrase. Administrator only, and not delegable — no role may hold it and
 * no approval can grant it.
 */
export async function resetBusinessData(confirmation: string): Promise<ActionState> {
  const admin = await requireAdmin();

  if (confirmation.trim() !== RESET_PHRASE) {
    return { error: `اكتب «${RESET_PHRASE}» بالضبط للتأكيد` };
  }

  const before = {
    buildings: await prisma.building.count(),
    units: await prisma.unit.count(),
    owners: await prisma.owner.count(),
    tenants: await prisma.tenant.count(),
    contracts: await prisma.contract.count(),
    payments: await prisma.payment.count(),
    documents: await prisma.financialDocument.count(),
  };

  // Ordered from the dependent to the depended-upon. Cascades would carry most of this, but
  // stating the order keeps the deletion from resting on a relation's configuration.
  await prisma.$transaction([
    prisma.financialDocument.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.agreementSettlement.deleteMany(),
    prisma.agreementBuilding.deleteMany(),
    prisma.managementAgreement.deleteMany(),
    prisma.ownerRemittance.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.buildingPhoto.deleteMany(),
    prisma.buildingContact.deleteMany(),
    prisma.buildingMeter.deleteMany(),
    prisma.building.deleteMany(),
    prisma.tenant.deleteMany(),
    // An owner's sign-in account belongs to the owner it was made for.
    prisma.user.deleteMany({ where: { role: "OWNER" } }),
    prisma.owner.deleteMany(),
    // Requests about records that no longer exist can never be decided.
    prisma.approvalRequest.deleteMany(),
  ]);

  // Deeds, signed agreements, property photos and vendor invoices belonged to what was deleted;
  // left behind they are files nothing references and nobody can reach.
  let filesRemoved = 0;
  for (const folder of ["deeds", "agreements", "photos", "expenses", "logos"]) {
    const dir = `${UPLOADS_ROOT}/${folder}`;
    try {
      const entries = await fs.readdir(dir);
      // The organisation's own logo survives, since its settings do.
      if (folder === "logos") continue;
      await Promise.all(entries.map((f) => fs.rm(`${dir}/${f}`, { force: true })));
      filesRemoved += entries.length;
    } catch {
      // A folder that was never created has nothing to remove.
    }
  }

  await recordAudit({
    user: admin,
    action: "settings.reset",
    summary:
      `تفريغ بيانات النظام: ${before.buildings} عقاراً و${before.units} وحدة و${before.owners} مالكاً ` +
      `و${before.tenants} مستأجراً و${before.contracts} عقداً و${before.payments} دفعة و${before.documents} مستنداً` +
      (filesRemoved ? ` و${filesRemoved} ملفاً مرفقاً` : ""),
  });

  for (const path of ["/", "/buildings", "/units", "/owners", "/tenants", "/contracts", "/payments", "/expenses", "/documents", "/agreements", "/approvals", "/notifications"]) {
    revalidatePath(path);
  }

  return {
    success: true,
    message: `أُفرغ النظام: ${before.contracts} عقداً و${before.payments} دفعة و${before.documents} مستنداً. الأدوار والحسابات وبيانات المنشأة باقية.`,
  };
}
