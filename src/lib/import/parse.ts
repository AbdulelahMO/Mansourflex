import ExcelJS from "exceljs";
import { IMPORT_SHEETS, type ImportColumn, type ImportSheet } from "@/lib/import/schema";

/**
 * Reads a filled workbook into rows, and says where every complaint belongs.
 *
 * An importer earns its keep by being specific: «الورقة: العقود · الصف 47 · الضريبة: اختر من 0
 * أو 5 أو 10 أو 15» sends someone to one cell. «الملف غير صالح» sends them back to typing by
 * hand. So nothing is rejected wholesale — every row is read, every fault is named with its
 * sheet, row and column, and the person decides once with the whole picture in front of them.
 */
export type RowIssue = { sheet: string; row: number; column: string; message: string };

export type ParsedRow = { row: number; values: Record<string, string | number | Date | null> };

export type ParsedSheet = {
  key: ImportSheet["key"];
  name: string;
  rows: ParsedRow[];
  issues: RowIssue[];
  /** A sheet the file does not carry at all — not a fault, just nothing to bring in. */
  missing: boolean;
};

const HEADER_ROW = 2;
const FIRST_DATA_ROW = 3;

/** Headers are matched on their text, ignoring the star that marks a required column. */
const normalise = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim();

function readCell(cell: ExcelJS.Cell): string | number | Date | null {
  const v = cell.value;
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string") return typeof v === "string" ? v.trim() || null : v;
  if (typeof v === "object" && "text" in v) return String(v.text).trim() || null;
  if (typeof v === "object" && "result" in v) return (v.result as string | number) ?? null;
  return String(v).trim() || null;
}

function validate(
  column: ImportColumn,
  raw: string | number | Date | null,
  sheetName: string,
  row: number
): { value: string | number | Date | null; issue?: RowIssue } {
  const fault = (message: string): RowIssue => ({ sheet: sheetName, row, column: column.header, message });

  if (raw === null) {
    if (column.required) return { value: null, issue: fault("مطلوب ولم يُملأ") };
    return { value: null };
  }

  if (column.kind === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n)) return { value: null, issue: fault(`«${raw}» ليس رقماً`) };
    return { value: n };
  }

  if (column.kind === "date") {
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (Number.isNaN(d.getTime())) return { value: null, issue: fault(`«${raw}» ليس تاريخاً — اكتبه هكذا 2026-01-01`) };
    return { value: d };
  }

  if (column.kind === "choice" && column.choices) {
    const text = String(raw).trim();
    const match = column.choices.find((c) => c === text);
    if (!match) return { value: null, issue: fault(`«${text}» غير مقبول — اختر من: ${column.choices.join(" · ")}`) };
    return { value: match };
  }

  return { value: String(raw).trim() };
}

export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  return IMPORT_SHEETS.map((sheet) => {
    const ws = wb.getWorksheet(sheet.name);
    if (!ws) return { key: sheet.key, name: sheet.name, rows: [], issues: [], missing: true };

    // Columns are found by their header text, so a reordered or re-widened sheet still reads.
    const headerRow = ws.getRow(HEADER_ROW);
    const columnAt = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const text = normalise(String(readCell(cell) ?? ""));
      const match = sheet.columns.find((c) => normalise(c.header) === text);
      if (match) columnAt.set(match.key, col);
    });

    const issues: RowIssue[] = [];
    const missingHeaders = sheet.columns.filter((c) => c.required && !columnAt.has(c.key));
    for (const c of missingHeaders) {
      issues.push({ sheet: sheet.name, row: HEADER_ROW, column: c.header, message: "عمود مطلوب غير موجود في الورقة" });
    }

    const rows: ParsedRow[] = [];
    for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
      const excelRow = ws.getRow(r);
      const values: Record<string, string | number | Date | null> = {};
      let hasAny = false;

      for (const column of sheet.columns) {
        const col = columnAt.get(column.key);
        const raw = col ? readCell(excelRow.getCell(col)) : null;
        if (raw !== null) hasAny = true;
        const { value, issue } = validate(column, raw, sheet.name, r);
        values[column.key] = value;
        if (issue) issues.push(issue);
      }

      // A blank row is where the person stopped, not an error to report.
      if (!hasAny) {
        for (let i = issues.length - 1; i >= 0 && issues[i].row === r; i--) issues.pop();
        continue;
      }
      rows.push({ row: r, values });
    }

    return { key: sheet.key, name: sheet.name, rows, issues, missing: false };
  });
}
