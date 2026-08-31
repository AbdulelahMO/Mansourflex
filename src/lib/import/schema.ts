/**
 * The workbook an office fills to bring its existing portfolio in.
 *
 * One definition drives three things: the template that is handed out, the reading of what comes
 * back, and the messages that name a bad cell. A column added here appears in all three, so the
 * template can never drift from what the importer expects — the failure that makes an import
 * tool worse than typing by hand, because it fails on the two-hundredth row.
 *
 * The sheets are ordered as the records depend on one another: an owner before the building they
 * own, a unit before the contract on it. A run follows that order, so one upload can carry a
 * whole portfolio.
 */
export type ColumnKind = "text" | "number" | "date" | "choice";

export type ImportColumn = {
  key: string;
  header: string;
  kind: ColumnKind;
  required?: boolean;
  choices?: readonly string[];
  hint?: string;
  width?: number;
};

export type ImportSheet = {
  key: "owners" | "buildings" | "units" | "tenants" | "contracts";
  name: string;
  /** Shown under the sheet's title row, so the person filling it knows what a row means. */
  note: string;
  columns: ImportColumn[];
};

const SECTORS = ["تجاري", "سكني", "تجاري - سكني", "صناعي", "زراعي"] as const;
const PROPERTY_TYPES = ["برج", "عمارة", "فيلا", "دوبلكس", "مجمع", "مركز تجاري", "معرض", "مستودع", "استراحة", "شاليه", "محطة", "أرض", "أخرى"] as const;
const UNIT_TYPES = ["شقة", "محل", "مكتب", "دور", "استوديو", "مستودع", "معرض", "غرفة", "أخرى"] as const;
const UNIT_STATUS = ["شاغرة", "تحت الصيانة"] as const;
const OWNER_TYPES = ["فرد", "شركة"] as const;
const TENANT_TYPES = ["فرد", "شركة"] as const;
const FREQUENCIES = ["شهري", "ربع سنوي", "نصف سنوي", "سنوي", "دفعة واحدة"] as const;
const AMOUNT_TYPES = ["سنوي", "إجمالي", "متزايد"] as const;
const VAT_RATES = ["0", "5", "10", "15"] as const;

export const IMPORT_SHEETS: ImportSheet[] = [
  {
    key: "owners",
    name: "الملاك",
    note: "المالك يُعرَّف مرة، وتُنسب إليه مبانيه باسمه في ورقة المباني.",
    columns: [
      { key: "name", header: "اسم المالك", kind: "text", required: true, width: 28 },
      { key: "ownerType", header: "النوع", kind: "choice", choices: OWNER_TYPES },
      { key: "phone", header: "الجوال", kind: "text", hint: "05xxxxxxxx" },
      { key: "nationalId", header: "رقم الهوية", kind: "text", hint: "10 أرقام" },
      { key: "email", header: "البريد الإلكتروني", kind: "text", width: 26 },
      { key: "taxNumber", header: "الرقم الضريبي", kind: "text" },
      { key: "notes", header: "ملاحظات", kind: "text", width: 30 },
    ],
  },
  {
    key: "buildings",
    name: "المباني",
    note: "اسم المالك يجب أن يطابق اسمه في ورقة الملاك أو مالكاً مسجّلاً في النظام.",
    columns: [
      { key: "name", header: "اسم العقار", kind: "text", required: true, width: 28 },
      { key: "ownerName", header: "اسم المالك", kind: "text", required: true, width: 24 },
      { key: "sector", header: "القطاع", kind: "choice", required: true, choices: SECTORS },
      { key: "city", header: "المدينة", kind: "text", required: true },
      { key: "district", header: "الحي", kind: "text", required: true },
      { key: "propertyType", header: "نوع العقار", kind: "choice", choices: PROPERTY_TYPES },
      { key: "address", header: "العنوان التفصيلي", kind: "text", width: 30 },
      { key: "deedNumber", header: "رقم الصك", kind: "text" },
      { key: "notes", header: "ملاحظات", kind: "text", width: 30 },
    ],
  },
  {
    key: "units",
    name: "الوحدات",
    note: "اسم العقار يطابق ما في ورقة المباني. ورقم الوحدة لا يتكرّر داخل العقار الواحد.",
    columns: [
      { key: "buildingName", header: "اسم العقار", kind: "text", required: true, width: 26 },
      { key: "unitNumber", header: "رقم الوحدة", kind: "text", required: true },
      { key: "unitType", header: "نوع الوحدة", kind: "choice", choices: UNIT_TYPES },
      { key: "floor", header: "الطابق", kind: "text" },
      { key: "areaSqm", header: "المساحة (م²)", kind: "number" },
      { key: "bedrooms", header: "غرف", kind: "number" },
      { key: "bathrooms", header: "دورات مياه", kind: "number" },
      { key: "rentAmount", header: "الإيجار السنوي", kind: "number" },
      { key: "status", header: "الحالة", kind: "choice", choices: UNIT_STATUS, hint: "الوحدة المؤجّرة تصير مؤجّرة بعقدها" },
    ],
  },
  {
    key: "tenants",
    name: "المستأجرون",
    note: "المستأجر يُعرَّف مرة، ويُنسب إليه عقده باسمه في ورقة العقود.",
    columns: [
      { key: "name", header: "اسم المستأجر", kind: "text", required: true, width: 28 },
      { key: "tenantType", header: "النوع", kind: "choice", choices: TENANT_TYPES },
      { key: "phone", header: "الجوال", kind: "text", required: true, hint: "05xxxxxxxx" },
      { key: "nationalId", header: "رقم الهوية", kind: "text", hint: "10 أرقام" },
      { key: "email", header: "البريد الإلكتروني", kind: "text", width: 26 },
      { key: "commercialRegister", header: "السجل التجاري", kind: "text", hint: "للشركات" },
      { key: "notes", header: "ملاحظات", kind: "text", width: 30 },
    ],
  },
  {
    key: "contracts",
    name: "العقود",
    note: "يُولَّد جدول الأقساط تلقائياً من المدة والدورية. ورقم العقد يمنحه النظام.",
    columns: [
      { key: "buildingName", header: "اسم العقار", kind: "text", required: true, width: 24 },
      { key: "unitNumber", header: "رقم الوحدة", kind: "text", required: true },
      { key: "tenantName", header: "اسم المستأجر", kind: "text", required: true, width: 24 },
      { key: "startDate", header: "تاريخ البداية", kind: "date", required: true, hint: "2026-01-01" },
      { key: "endDate", header: "تاريخ النهاية", kind: "date", required: true, hint: "2026-12-31" },
      { key: "rentAmount", header: "قيمة الإيجار", kind: "number", required: true },
      { key: "amountType", header: "نوع المبلغ", kind: "choice", required: true, choices: AMOUNT_TYPES },
      { key: "increasePercent", header: "نسبة الزيادة %", kind: "number", hint: "للمتزايد فقط" },
      { key: "paymentFrequency", header: "دورية السداد", kind: "choice", required: true, choices: FREQUENCIES },
      { key: "vatRate", header: "الضريبة %", kind: "choice", choices: VAT_RATES },
      { key: "depositAmount", header: "التأمين", kind: "number" },
      { key: "ejarContractNumber", header: "رقم عقد إيجار", kind: "text", hint: "من منصة إيجار" },
    ],
  },
];

export const SHEET_BY_KEY = new Map(IMPORT_SHEETS.map((s) => [s.key, s]));
