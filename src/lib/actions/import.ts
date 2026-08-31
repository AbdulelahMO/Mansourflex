"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, recordAudit } from "@/lib/authz";
import { runImport, type ImportPlan } from "@/lib/import/run";

export type ImportState = {
  plan?: ImportPlan;
  committed?: boolean;
  error?: string;
};

/**
 * Reads the workbook and reports what it would do, or does it.
 *
 * The dry run is not a convenience placed before the real one — it is the same run stopped short
 * of writing, so what the screen promises is what happens. And a file carrying a single bad cell
 * writes nothing at all: an office bringing two hundred contracts in cannot be left guessing
 * which of them got through.
 */
export async function reviewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { user } = await requirePermission("contracts.create");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف الاستيراد" };

  const commit = formData.get("commit") === "yes";

  try {
    const plan = await runImport(await file.arrayBuffer(), { commit });

    if (commit && plan.issues.length === 0) {
      const { counts } = plan;
      await recordAudit({
        user,
        action: "contracts.create",
        summary:
          `استيراد من ملف: ${counts.owners} مالكاً و${counts.buildings} عقاراً و${counts.units} وحدة ` +
          `و${counts.tenants} مستأجراً و${counts.contracts} عقداً`,
      });

      for (const path of ["/", "/owners", "/buildings", "/units", "/tenants", "/contracts", "/payments"]) {
        revalidatePath(path);
      }
      return { plan, committed: true };
    }

    return { plan };
  } catch (err) {
    // A file that is not a workbook, or one saved in a format ExcelJS cannot open.
    return { error: `تعذّرت قراءة الملف — ${err instanceof Error ? err.message : "تأكد أنه بصيغة xlsx"}` };
  }
}
