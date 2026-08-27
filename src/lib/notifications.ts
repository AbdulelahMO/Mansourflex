import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";

const CONTRACT_EXPIRY_WINDOW_DAYS = 30;
const PAYMENT_DUE_WINDOW_DAYS = 7;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Scans contracts and payments, creating in-app notifications for admins when new conditions are met. Safe to call repeatedly (idempotent per-day). */
export async function generateNotifications() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
  if (admins.length === 0) return { created: 0 };

  const now = new Date();
  let created = 0;

  const expiringContracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: addDays(now, CONTRACT_EXPIRY_WINDOW_DAYS), gte: now },
    },
    include: { unit: { include: { building: true } }, tenant: true },
  });

  for (const contract of expiringContracts) {
    const already = await prisma.notification.findFirst({
      where: { type: "CONTRACT_EXPIRY", contractId: contract.id, createdAt: { gte: addDays(now, -7) } },
    });
    if (already) continue;

    const daysLeft = Math.ceil((contract.endDate.getTime() - now.getTime()) / 86_400_000);
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          type: "CONTRACT_EXPIRY",
          channel: "IN_APP",
          status: "SENT",
          sentAt: now,
          userId: admin.id,
          contractId: contract.id,
          title: "عقد قارب على الانتهاء",
          message: `عقد ${contract.contractNumber} (${contract.tenant.name} - وحدة ${contract.unit.unitNumber} في ${contract.unit.building.name}) ينتهي خلال ${daysLeft} يوم`,
        },
      });
      created++;
    }
  }

  const overduePayments = await prisma.payment.findMany({
    where: { status: "OVERDUE" },
    include: { contract: { include: { unit: { include: { building: true } }, tenant: true } } },
  });

  for (const payment of overduePayments) {
    const already = await prisma.notification.findFirst({
      where: { type: "PAYMENT_OVERDUE", paymentId: payment.id, createdAt: { gte: addDays(now, -3) } },
    });
    if (already) continue;

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          type: "PAYMENT_OVERDUE",
          channel: "IN_APP",
          status: "SENT",
          sentAt: now,
          userId: admin.id,
          contractId: payment.contractId,
          paymentId: payment.id,
          title: "دفعة متأخرة",
          message: `دفعة بقيمة ${formatCurrency(payment.amount)} من ${payment.contract.tenant.name} (عقد ${payment.contract.contractNumber}) متأخرة عن موعدها`,
        },
      });
      created++;
    }
  }

  const upcomingPayments = await prisma.payment.findMany({
    where: { status: "PENDING", dueDate: { lte: addDays(now, PAYMENT_DUE_WINDOW_DAYS), gte: now } },
    include: { contract: { include: { unit: { include: { building: true } }, tenant: true } } },
  });

  for (const payment of upcomingPayments) {
    const already = await prisma.notification.findFirst({
      where: { type: "PAYMENT_DUE", paymentId: payment.id, createdAt: { gte: addDays(now, -7) } },
    });
    if (already) continue;

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          type: "PAYMENT_DUE",
          channel: "IN_APP",
          status: "SENT",
          sentAt: now,
          userId: admin.id,
          contractId: payment.contractId,
          paymentId: payment.id,
          title: "دفعة مستحقة قريباً",
          message: `دفعة بقيمة ${formatCurrency(payment.amount)} من ${payment.contract.tenant.name} (عقد ${payment.contract.contractNumber}) مستحقة بتاريخ ${formatDate(payment.dueDate)}`,
        },
      });
      created++;
    }
  }

  return { created };
}
