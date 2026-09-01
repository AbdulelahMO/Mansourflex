/**
 * The way back in when the administrator's own password is gone.
 *
 * Everyone else has someone above them: the admin resets an employee's password, and an owner's.
 * The admin has nobody — and since a forgotten password now costs a locked account and a rising
 * wait, «I will work it out on the day» is not a plan. Whoever holds the server holds the
 * database anyway, so this opens no door that was shut; it writes the path down instead of
 * leaving it to be improvised during the emergency.
 *
 *   npm run admin -- someone@example.com            يعيد تعيين كلمة مرور مدير موجود
 *   npm run admin -- someone@example.com "الاسم"     يُنشئ مديراً ثانياً إن لم يكن موجوداً
 *
 * The password it prints is temporary: it is shown once, never stored anywhere legible, and the
 * holder is made to replace it the moment they sign in.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { generateTemporaryPassword } from "../src/lib/passwords";

async function main() {
  const [rawEmail, name] = process.argv.slice(2);

  if (!rawEmail) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, name: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    console.log("\nالاستخدام:");
    console.log('  npm run admin -- <البريد> ["الاسم"]\n');
    console.log(`حسابات المدير المسجّلة (${admins.length}):`);
    for (const a of admins) {
      console.log(`  ${a.email} — ${a.name}${a.isActive ? "" : " (موقوف)"}`);
    }
    if (admins.length < 2) {
      console.log("\nتنبيه: لا يوجد إلا مدير واحد. أنشئ ثانياً ليعيد أحدهما تعيين الآخر دون الخادم.");
    }
    return;
  }

  const email = rawEmail.toLowerCase().trim();
  const temporary = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporary, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        mustChangePassword: true,
        // A recovered account is of no use while it is switched off, and the lock that was
        // holding the door shut belongs to the password that is now gone.
        isActive: true,
        ...(existing.role === "ADMIN" ? {} : { role: "ADMIN" as const }),
      },
    });
    await prisma.loginAttempt.deleteMany({ where: { email } });

    console.log(`\nأُعيد تعيين كلمة مرور ${existing.name} (${email})`);
    if (existing.role !== "ADMIN") console.log("ورُقّي الحساب إلى مدير.");
  } else {
    if (!name) {
      console.error(`\nلا يوجد حساب بالبريد ${email}. لإنشاء مدير جديد أضف اسمه:`);
      console.error(`  npm run admin -- ${email} "الاسم الكامل"`);
      process.exitCode = 1;
      return;
    }

    await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN", mustChangePassword: true },
    });
    console.log(`\nأُنشئ حساب مدير جديد: ${name} (${email})`);
  }

  console.log(`كلمة المرور المؤقتة: ${temporary}`);
  console.log("تُغيَّر إلزامياً عند أول تسجيل دخول، ولن تظهر مرة أخرى.\n");
}

main()
  .catch((err) => {
    console.error("تعذّر التنفيذ:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
