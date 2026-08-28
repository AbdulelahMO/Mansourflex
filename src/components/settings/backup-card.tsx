"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Downloads a full backup — database snapshot plus attachments — in one archive.
 * Fetched rather than linked so a failure surfaces as a message instead of a broken file.
 */
export function BackupCard() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "تعذّر إنشاء النسخة الاحتياطية");
        return;
      }

      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "backup.tar.gz";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`تم تنزيل النسخة (${(blob.size / 1024 / 1024).toFixed(1)} ميجابايت)`);
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3.5">
        <CardTitle className="text-base">النسخة الاحتياطية</CardTitle>
        <p className="text-xs text-muted-foreground">
          نسخة كاملة من قاعدة البيانات ومرفقاتها — الصكوك والاتفاقيات الموقّعة وصور العقارات وفواتير الموردين
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          خذ نسخة قبل أي عملية كبيرة — حذف عقار، أو ترحيل بيانات. تُؤخذ اللقطة والنظام يعمل، ويُسجَّل التنزيل في
          سجل العمليات.
        </p>
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {busy ? "جارٍ التجهيز…" : "تنزيل نسخة احتياطية"}
        </Button>
      </CardContent>
    </Card>
  );
}
