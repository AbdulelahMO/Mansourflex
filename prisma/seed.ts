import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "مدير النظام",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      name: "محمد العتيبي",
      email: "owner@example.com",
      passwordHash: await bcrypt.hash("Owner@12345", 10),
      role: "OWNER",
    },
  });

  const owner = await prisma.owner.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      name: "محمد العتيبي",
      phone: "0501234567",
      email: "owner@example.com",
      userId: ownerUser.id,
    },
  });

  const building = await prisma.building.create({
    data: {
      name: "برج النخيل",
      city: "الرياض",
      district: "حي العليا",
      address: "شارع التخصصي",
      ownerId: owner.id,
      units: {
        create: [
          { unitNumber: "101", floor: "1", unitType: "سكني", areaSqm: 120, bedrooms: 3, bathrooms: 2, rentAmount: 35000, status: "OCCUPIED" },
          { unitNumber: "102", floor: "1", unitType: "سكني", areaSqm: 95, bedrooms: 2, bathrooms: 1, rentAmount: 28000, status: "VACANT" },
          { unitNumber: "201", floor: "2", unitType: "تجاري", areaSqm: 60, rentAmount: 40000, status: "VACANT" },
        ],
      },
    },
    include: { units: true },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "خالد الشمري",
      phone: "0559876543",
      email: "khaled@example.com",
      nationalId: "1012345678",
    },
  });

  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const contract = await prisma.contract.create({
    data: {
      contractNumber: `C-${Date.now()}`,
      unitId: building.units[0].id,
      tenantId: tenant.id,
      startDate,
      endDate,
      rentAmount: 35000,
      depositAmount: 3500,
      paymentFrequency: "QUARTERLY",
      status: "ACTIVE",
    },
  });

  await prisma.payment.create({
    data: {
      contractId: contract.id,
      dueDate: startDate,
      amount: 8750,
      status: "PENDING",
    },
  });

  console.log("\n✅ تم إنشاء بيانات تجريبية بنجاح\n");
  console.log("بيانات دخول مدير النظام:");
  console.log(`  البريد: ${admin.email}`);
  console.log(`  كلمة المرور: ${adminPassword}`);
  console.log("\nبيانات دخول المالك التجريبي:");
  console.log(`  البريد: owner@example.com`);
  console.log(`  كلمة المرور: Owner@12345\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
