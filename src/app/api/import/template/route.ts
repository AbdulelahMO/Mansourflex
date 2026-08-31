import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { buildImportTemplate } from "@/lib/import/template";

/** Hands out the workbook to fill. Behind the same permission that lets a person import. */
export async function GET() {
  try {
    await requirePermission("buildings.create");
  } catch {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const buffer = await buildImportTemplate();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
