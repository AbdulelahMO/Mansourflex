import "server-only";
import ExcelJS from "exceljs";
import { IMPORT_SHEETS } from "@/lib/import/schema";

/**
 * Builds the workbook from the same definition the importer reads by, so a column can never be
 * present in one and absent from the other. The sheets are right-to-left and the choice columns
 * are validated in Excel itself: a wrong sector is refused where it is typed, not after upload.
 */
export async function buildImportTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام إدارة الأملاك";
  wb.created = new Date();

  for (const sheet of IMPORT_SHEETS) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }] });

    // Row 1 explains the sheet; row 2 carries the headers the importer matches on.
    ws.mergeCells(1, 1, 1, sheet.columns.length);
    const note = ws.getCell(1, 1);
    note.value = sheet.note;
    note.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
    note.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(1).height = 22;

    sheet.columns.forEach((col, i) => {
      const cell = ws.getCell(2, i + 1);
      cell.value = col.required ? `${col.header} *` : col.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.required ? "FF1F4E45" : "FF64748B" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (col.hint) cell.note = col.hint;
      ws.getColumn(i + 1).width = col.width ?? 16;

      if (col.choices) {
        // Excel refuses a wrong value in the cell itself — cheaper than a message after upload.
        for (let r = 3; r <= 500; r++) {
          ws.getCell(r, i + 1).dataValidation = {
            type: "list",
            allowBlank: !col.required,
            formulae: [`"${col.choices.join(",")}"`],
            showErrorMessage: true,
            errorTitle: "قيمة غير مقبولة",
            error: `اختر من: ${col.choices.join(" · ")}`,
          };
        }
      }
      if (col.kind === "date") {
        for (let r = 3; r <= 500; r++) ws.getCell(r, i + 1).numFmt = "yyyy-mm-dd";
      }
    });

    ws.getRow(2).height = 20;
  }

  // ExcelJS types its own Buffer; over the wire it is the bytes.
  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
