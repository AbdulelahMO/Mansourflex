import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ScanButton, MarkAllReadButton, NotificationRow } from "@/components/notifications/notification-actions";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground">تنبيهات العقود المنتهية والدفعات المستحقة</p>
        </div>
        {user.role === "ADMIN" && <ScanButton />}
      </div>

      <Card className="gap-0 py-0">
        {notifications.length > 0 && (
          <div className="flex justify-end border-b px-2 py-1">
            <MarkAllReadButton />
          </div>
        )}
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Bell className="size-10" />
              <p>لا توجد إشعارات حالياً</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                id={n.id}
                title={n.title}
                message={n.message}
                isRead={n.isRead}
                createdAt={formatDate(n.createdAt)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
