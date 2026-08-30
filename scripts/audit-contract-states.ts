/**
 * Checks the contracts and their units against the rules the system holds them to. A unit is
 * held by a live contract and released only by an explicit decision, so a disagreement between
 * the two is not cosmetic: a unit shown free while it is let gets offered to a second tenant.
 *
 * Reports and never writes — what to do about a contract whose term has run out is a decision,
 * not a repair.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const units = await prisma.unit.findMany({
    include: { building: { select: { name: true } }, contracts: { select: { id: true, contractNumber: true, status: true, endDate: true } } },
  });

  const findings: Record<string, string[]> = {
    "عقد سارٍ وقد انقضت مدته": [],
    "عقد منتهٍ ومدته لم تنقضِ (فُسخ قبل أوانه)": [],
    "وحدة شاغرة وعليها عقد سارٍ": [],
    "وحدة تحت الصيانة وعليها عقد سارٍ": [],
    "وحدة مؤجرة ولم يُكتب عليها عقد قط": [],
    "وحدة عليها أكثر من عقد سارٍ": [],
  };

  for (const u of units) {
    const label = `${u.building.name} - ${u.unitNumber}`;
    const live = u.contracts.filter((c) => c.status === "ACTIVE");

    for (const c of u.contracts) {
      if (c.status === "ACTIVE" && c.endDate < now) findings["عقد سارٍ وقد انقضت مدته"].push(`${c.contractNumber} (${label})`);
      if (c.status === "EXPIRED" && c.endDate > now) findings["عقد منتهٍ ومدته لم تنقضِ (فُسخ قبل أوانه)"].push(c.contractNumber);
    }

    if (live.length > 1) findings["وحدة عليها أكثر من عقد سارٍ"].push(label);
    if (live.length > 0 && u.status === "VACANT") findings["وحدة شاغرة وعليها عقد سارٍ"].push(label);
    if (live.length > 0 && u.status === "MAINTENANCE") findings["وحدة تحت الصيانة وعليها عقد سارٍ"].push(label);
    if (u.contracts.length === 0 && u.status === "OCCUPIED") findings["وحدة مؤجرة ولم يُكتب عليها عقد قط"].push(label);
  }

  for (const [k, v] of Object.entries(findings)) {
    console.log(`${v.length ? "✗" : "✓"} ${k}: ${v.length}${v.length ? " — " + v.slice(0, 6).join("، ") : ""}`);
  }
  await prisma.$disconnect();
}
main();
