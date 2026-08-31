import "server-only";
import { prisma } from "@/lib/prisma";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { parseWorkbook, type RowIssue } from "@/lib/import/parse";

/**
 * Brings a filled workbook in, in the order the records depend on one another.
 *
 * The sheets name each other by name — a building says whose it is, a contract says which unit —
 * because a person filling a spreadsheet knows «برج النخيل» and does not know its identifier. So
 * the run resolves names as it goes, against what the file carries and what the system already
 * holds, and a name that resolves to nothing is reported with its row rather than guessed at.
 *
 * Nothing is written until every sheet has been read and every name resolved: an import that
 * fails at the two-hundredth row and leaves the first hundred and ninety-nine behind is worse
 * than no import, because now the operator has to find out what got in.
 */
export type ImportPlan = {
  issues: RowIssue[];
  counts: { owners: number; buildings: number; units: number; tenants: number; contracts: number };
  /** Rows the file carries that the system already has, matched by name or number. */
  skipped: { sheet: string; row: number; reason: string }[];
};

type Row = Record<string, string | number | Date | null>;
const text = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

const FREQUENCY: Record<string, string> = {
  "شهري": "MONTHLY",
  "ربع سنوي": "QUARTERLY",
  "نصف سنوي": "SEMI_ANNUAL",
  "سنوي": "ANNUAL",
  "دفعة واحدة": "ONE_TIME",
};
const AMOUNT_TYPE: Record<string, string> = { "سنوي": "ANNUAL", "إجمالي": "TOTAL", "متزايد": "INCREASING" };
const UNIT_STATUS: Record<string, "VACANT" | "MAINTENANCE"> = { "شاغرة": "VACANT", "تحت الصيانة": "MAINTENANCE" };
const PARTY_TYPE: Record<string, string> = { "فرد": "INDIVIDUAL", "شركة": "COMPANY" };

export async function runImport(data: ArrayBuffer, opts: { commit: boolean }): Promise<ImportPlan> {
  const sheets = await parseWorkbook(data);
  const bySheet = new Map(sheets.map((s) => [s.key, s]));
  const issues: RowIssue[] = sheets.flatMap((s) => s.issues);
  const skipped: ImportPlan["skipped"] = [];

  const rowsOf = (key: string) => bySheet.get(key as never)?.rows ?? [];
  const fault = (sheet: string, row: number, column: string, message: string) =>
    issues.push({ sheet, row, column, message });

  // What the system already holds, so a second run adds what is new instead of duplicating.
  const [existingOwners, existingBuildings, existingTenants] = await Promise.all([
    prisma.owner.findMany({ select: { id: true, name: true } }),
    prisma.building.findMany({ select: { id: true, name: true } }),
    prisma.tenant.findMany({ select: { id: true, name: true } }),
  ]);

  const ownerByName = new Map(existingOwners.map((o) => [o.name.trim(), o.id]));
  const buildingByName = new Map(existingBuildings.map((b) => [b.name.trim(), b.id]));
  const tenantByName = new Map(existingTenants.map((t) => [t.name.trim(), t.id]));

  const newOwners: { name: string; data: Record<string, unknown> }[] = [];
  for (const { row, values } of rowsOf("owners")) {
    const v = values as Row;
    const name = text(v.name);
    if (!name) continue;
    if (ownerByName.has(name) || newOwners.some((o) => o.name === name)) {
      skipped.push({ sheet: "الملاك", row, reason: `«${name}» مسجّل مسبقاً` });
      continue;
    }
    newOwners.push({
      name,
      data: {
        name,
        ownerType: PARTY_TYPE[String(text(v.ownerType) ?? "")] ?? null,
        phone: text(v.phone),
        nationalId: text(v.nationalId),
        email: text(v.email),
        taxNumber: text(v.taxNumber),
        notes: text(v.notes),
      },
    });
  }

  const newBuildings: { name: string; ownerName: string; data: Record<string, unknown> }[] = [];
  for (const { row, values } of rowsOf("buildings")) {
    const v = values as Row;
    const name = text(v.name);
    const ownerName = text(v.ownerName);
    if (!name || !ownerName) continue;

    if (buildingByName.has(name) || newBuildings.some((b) => b.name === name)) {
      skipped.push({ sheet: "المباني", row, reason: `«${name}» مسجّل مسبقاً` });
      continue;
    }
    if (!ownerByName.has(ownerName) && !newOwners.some((o) => o.name === ownerName)) {
      fault("المباني", row, "اسم المالك", `«${ownerName}» لا يوجد في ورقة الملاك ولا في النظام`);
      continue;
    }

    newBuildings.push({
      name,
      ownerName,
      data: {
        name,
        sector: text(v.sector),
        city: text(v.city),
        district: text(v.district),
        propertyType: text(v.propertyType),
        address: text(v.address),
        deedNumber: text(v.deedNumber),
        notes: text(v.notes),
      },
    });
  }

  const existingUnits = await prisma.unit.findMany({ select: { buildingId: true, unitNumber: true } });
  const unitKey = (buildingName: string, unitNumber: string) => `${buildingName}||${unitNumber}`;
  const buildingNameById = new Map(existingBuildings.map((b) => [b.id, b.name.trim()]));
  const takenUnits = new Set(
    existingUnits.map((u) => unitKey(buildingNameById.get(u.buildingId) ?? "", u.unitNumber))
  );

  const newUnits: { buildingName: string; unitNumber: string; data: Record<string, unknown> }[] = [];
  for (const { row, values } of rowsOf("units")) {
    const v = values as Row;
    const buildingName = text(v.buildingName);
    const unitNumber = text(v.unitNumber);
    if (!buildingName || !unitNumber) continue;

    if (!buildingByName.has(buildingName) && !newBuildings.some((b) => b.name === buildingName)) {
      fault("الوحدات", row, "اسم العقار", `«${buildingName}» لا يوجد في ورقة المباني ولا في النظام`);
      continue;
    }
    const key = unitKey(buildingName, unitNumber);
    if (takenUnits.has(key) || newUnits.some((u) => unitKey(u.buildingName, u.unitNumber) === key)) {
      skipped.push({ sheet: "الوحدات", row, reason: `الوحدة ${unitNumber} موجودة في ${buildingName}` });
      continue;
    }

    newUnits.push({
      buildingName,
      unitNumber,
      data: {
        unitNumber,
        unitType: text(v.unitType),
        floor: text(v.floor),
        areaSqm: num(v.areaSqm),
        bedrooms: num(v.bedrooms),
        bathrooms: num(v.bathrooms),
        rentAmount: num(v.rentAmount),
        status: UNIT_STATUS[String(text(v.status) ?? "")] ?? "VACANT",
      },
    });
  }

  const newTenants: { name: string; data: Record<string, unknown> }[] = [];
  for (const { row, values } of rowsOf("tenants")) {
    const v = values as Row;
    const name = text(v.name);
    if (!name) continue;
    if (tenantByName.has(name) || newTenants.some((t) => t.name === name)) {
      skipped.push({ sheet: "المستأجرون", row, reason: `«${name}» مسجّل مسبقاً` });
      continue;
    }
    newTenants.push({
      name,
      data: {
        name,
        tenantType: PARTY_TYPE[String(text(v.tenantType) ?? "")] ?? null,
        phone: text(v.phone),
        nationalId: text(v.nationalId),
        email: text(v.email),
        commercialRegister: text(v.commercialRegister),
        notes: text(v.notes),
      },
    });
  }

  const newContracts: {
    buildingName: string;
    unitNumber: string;
    tenantName: string;
    data: Record<string, unknown>;
    schedule: { dueDate: Date; amount: number }[];
  }[] = [];

  for (const { row, values } of rowsOf("contracts")) {
    const v = values as Row;
    const buildingName = text(v.buildingName);
    const unitNumber = text(v.unitNumber);
    const tenantName = text(v.tenantName);
    if (!buildingName || !unitNumber || !tenantName) continue;

    const unitExists =
      takenUnits.has(unitKey(buildingName, unitNumber)) ||
      newUnits.some((u) => u.buildingName === buildingName && u.unitNumber === unitNumber);
    if (!unitExists) {
      fault("العقود", row, "رقم الوحدة", `الوحدة ${unitNumber} غير موجودة في ${buildingName}`);
      continue;
    }
    if (!tenantByName.has(tenantName) && !newTenants.some((t) => t.name === tenantName)) {
      fault("العقود", row, "اسم المستأجر", `«${tenantName}» لا يوجد في ورقة المستأجرين ولا في النظام`);
      continue;
    }

    const startDate = v.startDate instanceof Date ? v.startDate : null;
    const endDate = v.endDate instanceof Date ? v.endDate : null;
    const rentAmount = num(v.rentAmount);
    if (!startDate || !endDate || rentAmount === null) continue;
    if (endDate <= startDate) {
      fault("العقود", row, "تاريخ النهاية", "يجب أن يكون بعد تاريخ البداية");
      continue;
    }

    const amountType = AMOUNT_TYPE[String(text(v.amountType) ?? "")] ?? "ANNUAL";
    const frequency = FREQUENCY[String(text(v.paymentFrequency) ?? "")] ?? "ANNUAL";
    const increasePercent = amountType === "INCREASING" ? num(v.increasePercent) ?? 0 : 0;
    if (amountType === "INCREASING" && increasePercent <= 0) {
      fault("العقود", row, "نسبة الزيادة %", "مطلوبة للعقد المتزايد");
      continue;
    }
    const vatRate = Number(text(v.vatRate) ?? 0) || 0;

    const schedule = buildPaymentSchedule(
      startDate,
      endDate,
      rentAmount,
      frequency,
      amountType as "TOTAL" | "ANNUAL" | "INCREASING",
      increasePercent,
      vatRate
    );
    if (schedule.length === 0) {
      fault("العقود", row, "دورية السداد", "لم يُنتج جدول أقساط — راجع التواريخ والدورية");
      continue;
    }

    newContracts.push({
      buildingName,
      unitNumber,
      tenantName,
      data: {
        startDate,
        endDate,
        rentAmount,
        amountType,
        increasePercent: amountType === "INCREASING" ? increasePercent : null,
        vatRate,
        depositAmount: num(v.depositAmount),
        paymentFrequency: frequency,
        ejarContractNumber: text(v.ejarContractNumber),
        status: "ACTIVE",
      },
      schedule: schedule.map((p) => ({ dueDate: p.dueDate, amount: p.amount })),
    });
  }

  const counts = {
    owners: newOwners.length,
    buildings: newBuildings.length,
    units: newUnits.length,
    tenants: newTenants.length,
    contracts: newContracts.length,
  };

  if (!opts.commit || issues.length > 0) return { issues, counts, skipped };

  await prisma.$transaction(
    async (tx) => {
      for (const o of newOwners) {
        const created = await tx.owner.create({ data: o.data as never });
        ownerByName.set(o.name, created.id);
      }
      for (const b of newBuildings) {
        const created = await tx.building.create({
          data: { ...(b.data as object), ownerId: ownerByName.get(b.ownerName) } as never,
        });
        buildingByName.set(b.name, created.id);
      }
      for (const u of newUnits) {
        await tx.unit.create({
          data: { ...(u.data as object), buildingId: buildingByName.get(u.buildingName) } as never,
        });
      }
      for (const t of newTenants) {
        const created = await tx.tenant.create({ data: t.data as never });
        tenantByName.set(t.name, created.id);
      }

      for (const c of newContracts) {
        const buildingId = buildingByName.get(c.buildingName);
        const unit = await tx.unit.findFirst({
          where: { buildingId, unitNumber: c.unitNumber },
          select: { id: true },
        });
        if (!unit) continue;

        await tx.contract.create({
          data: {
            ...(c.data as object),
            contractNumber: await nextContractNumber(tx),
            unitId: unit.id,
            tenantId: tenantByName.get(c.tenantName),
            payments: { create: c.schedule },
          } as never,
        });
        await tx.unit.update({ where: { id: unit.id }, data: { status: "OCCUPIED" } });
      }
    },
    { timeout: 120_000 }
  );

  return { issues, counts, skipped };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The system issues contract numbers; the sheet never carries one. */
async function nextContractNumber(tx: Tx) {
  const year = new Date().getFullYear();
  const scope = `C-${year}-`;
  const issued = await tx.contract.findMany({
    where: { contractNumber: { startsWith: scope } },
    select: { contractNumber: true },
  });
  const highest = issued.reduce((max, c) => {
    const seq = Number(c.contractNumber.slice(scope.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${scope}${String(highest + 1).padStart(4, "0")}`;
}
