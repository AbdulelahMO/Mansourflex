/**
 * ما تحتاجه نسخة جديدة قبل أن يدخلها أحد: الأدوار وحساب مدير واحد.
 *
 * This runs on every boot, so it must be safe to run on every boot. It differs from
 * `seed.ts` in two ways that matter on a server: it creates no demo building, tenant or
 * contract, and it repeats without duplicating anything. `seed.ts` calls `create` for the
 * sample records, so a second run there leaves a second برج النخيل behind.
 *
 * Roles come first for the same reason they do in the seed: an employee account is worth
 * nothing without one to hold.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applySystemRoles } from "../src/lib/system-roles";

const prisma = new PrismaClient();

async function main() {
  for (const r of await applySystemRoles(prisma as never)) {
    if (r.created) console.log(`أُنشئ الدور: ${r.role} (${r.added.length} صلاحية)`);
    else if (r.added.length) console.log(`استُكمل الدور ${r.role}: ${r.added.join("، ")}`);
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    // Not a failure. Once the account exists the variables have done their job and are
    // better removed than left sitting in the service's configuration.
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD غير مضبوطين — لم يُنشأ حساب مدير.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Never rewrite the stored hash: a variable left behind from the first boot would
    // otherwise silently undo every password change the administrator has made since.
    console.log(`حساب المدير موجود: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: "مدير النظام",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      // The password arrived through the service's configuration, where it is readable by
      // anyone who can open it. It is a way in, not a password.
      mustChangePassword: true,
    },
  });
  console.log(`أُنشئ حساب المدير: ${email} — تُطلب كلمة مرور جديدة عند أول دخول.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
