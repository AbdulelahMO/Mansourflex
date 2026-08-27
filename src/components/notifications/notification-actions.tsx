"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCheck } from "lucide-react";
import { runNotificationScan, markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

export function ScanButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runNotificationScan();
          if (res.message) toast.success(res.message);
          if (res.error) toast.error(res.error);
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      فحص الآن
    </Button>
  );
}

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(() => markAllNotificationsRead())}>
      <CheckCheck className="size-4" />
      تعليم الكل كمقروء
    </Button>
  );
}

export function NotificationRow({
  id,
  title,
  message,
  isRead,
  createdAt,
}: {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => !isRead && startTransition(() => markNotificationRead(id))}
      disabled={pending}
      className={`w-full text-right border-b p-4 last:border-0 transition-colors ${
        isRead ? "bg-background" : "bg-primary/5 hover:bg-primary/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {!isRead && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{createdAt}</p>
    </button>
  );
}
