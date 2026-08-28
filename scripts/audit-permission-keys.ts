/**
 * Finds permission rows pointing at keys the catalogue no longer defines. Such a row is inert —
 * the live key falls through to the role's catch-all rule instead — so a renamed key silently
 * withdraws a right the role still advertises.
 */
import { prisma } from "../src/lib/prisma";
import { ALL_PERMISSIONS, ALWAYS_ADMIN_ONLY } from "../src/lib/permissions";

async function main() {
  const known = new Map(ALL_PERMISSIONS.map((p) => [p.key, p]));

  const roleRows = await prisma.rolePermission.findMany({ include: { role: { select: { name: true } } } });
  const userRows = await prisma.userPermission.findMany({ include: { user: { select: { name: true } } } });

  const deadRole = roleRows.filter((r) => !known.has(r.key));
  const deadUser = userRows.filter((r) => !known.has(r.key));
  const adminOnlyRole = roleRows.filter((r) => ALWAYS_ADMIN_ONLY.has(r.key));
  const adminOnlyUser = userRows.filter((r) => ALWAYS_ADMIN_ONLY.has(r.key));

  console.log(`المفاتيح المعرّفة: ${known.size} | صفوف الأدوار: ${roleRows.length} | استثناءات الأفراد: ${userRows.length}`);

  console.log("\n— مفاتيح ميتة في الأدوار —");
  if (deadRole.length === 0) console.log("  لا يوجد");
  for (const r of deadRole) console.log(`  ${r.role.name}: ${r.key} = ${r.state}`);

  console.log("\n— مفاتيح ميتة في استثناءات الأفراد —");
  if (deadUser.length === 0) console.log("  لا يوجد");
  for (const r of deadUser) console.log(`  ${r.user.name}: ${r.key} = ${r.state}`);

  console.log("\n— صفوف على صلاحيات لا تُفوَّض أصلاً (تُتجاهل دائماً) —");
  const ignored = [...adminOnlyRole.map((r) => `${r.role.name}: ${r.key}`), ...adminOnlyUser.map((r) => `${r.user.name}: ${r.key}`)];
  console.log(ignored.length ? ignored.map((x) => `  ${x}`).join("\n") : "  لا يوجد");

  // A catch-all role denies every sensitive key it has no row for — the gap that hides the loss.
  const roles = await prisma.staffRole.findMany({ include: { permissions: true } });
  console.log("\n— صلاحيات حسّاسة يمنعها الدور الوراثي بلا سطر صريح —");
  for (const role of roles) {
    if (!role.inheritsAll) continue;
    const held = new Set(role.permissions.map((p) => p.key));
    const denied = ALL_PERMISSIONS.filter((p) => p.sensitive && !p.adminOnly && !held.has(p.key)).map((p) => p.key);
    console.log(`  ${role.name}: ${denied.length ? denied.join("، ") : "لا يوجد"}`);
  }

  await prisma.$disconnect();
}

main();
