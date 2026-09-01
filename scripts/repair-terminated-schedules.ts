/**
 * Instalments left behind by contracts that were broken.
 *
 * Ending a contract used to change its status and nothing else, so its future instalments stayed
 * in the schedule: the property kept reporting rent it would never receive, and arrears nobody
 * owed. Termination now clears them as it happens — this clears what was left before it did.
 *
 * What is never touched: an instalment carrying money, one that has a document against it, and
 * anything that fell due before today. Those are records of what happened, and a tenant who left
 * owing rent still owes it — the debt follows the tenant, not the lease.
 *
 *   npx tsx scripts/repair-terminated-schedules.ts            يعرض ولا يكتب
 *   npx tsx scripts/repair-terminated-schedules.ts --apply    ينفّذ
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");
  const now = new Date();

  const stranded = await prisma.payment.findMany({
    where: {
      contract: { status: "TERMINATED" },
      dueDate: { gt: now },
      OR: [{ paidAmount: null }, { paidAmount: 0 }],
      documents: { none: {} },
    },
    select: {
      id: true,
      dueDate: true,
      amount: true,
      contract: {
        select: { contractNumber: true, endDate: true, unit: { select: { unitNumber: true, building: { select: { name: true } } } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  if (stranded.length === 0) {
    console.log("\nلا توجد أقساط معلّقة على عقود مفسوخة — لا شيء يُصحَّح.\n");
    return;
  }

  const byContract = new Map<string, { count: number; total: number; place: string }>();
  for (const p of stranded) {
    const key = p.contract.contractNumber;
    const row = byContract.get(key) ?? {
      count: 0,
      total: 0,
      place: `${p.contract.unit.building.name} - ${p.contract.unit.unitNumber}`,
    };
    row.count += 1;
    row.total += p.amount;
    byContract.set(key, row);
  }

  const total = stranded.reduce((sum, p) => sum + p.amount, 0);
  console.log(`\n${stranded.length} قسطاً على ${byContract.size} عقداً مفسوخاً، بمجموع ${Math.round(total).toLocaleString("en")} ريال:\n`);
  for (const [number, row] of byContract) {
    console.log(`  ${number} — ${row.place}: ${row.count} قسطاً، ${Math.round(row.total).toLocaleString("en")} ريال`);
  }

  if (!apply) {
    console.log("\nعرضٌ فقط. للتنفيذ: npx tsx scripts/repair-terminated-schedules.ts --apply\n");
    return;
  }

  const result = await prisma.payment.deleteMany({ where: { id: { in: stranded.map((p) => p.id) } } });
  console.log(`\nحُذف ${result.count} قسطاً. أعِد فتح كشوف الملاك لترى الأثر.\n`);
}

main()
  .catch((err) => {
    console.error("تعذّر التنفيذ:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
