"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, TriangleAlert, Check } from "lucide-react";
import { toast } from "sonner";
import { resetBusinessData } from "@/lib/actions/reset";
import { RESET_PHRASE } from "@/lib/reset-phrase";

/**
 * Emptying the system to start over.
 *
 * The backup is not advice printed beside the button — the button does not exist until the file
 * has reached the browser. And the confirmation is typed, not clicked: a phrase written by hand
 * is a decision, while a second click is the same reflex as the first.
 */
export function ResetCard() {
  const [downloading, setDownloading] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [pending, startTransition] = useTransition();

  async function downloadBackup() {
    setDownloading(true);
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
      setBackedUp(true);
      toast.success(`نُزّلت النسخة (${(blob.size / 1024 / 1024).toFixed(1)} ميجابايت) — احفظها قبل المتابعة`);
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <TriangleAlert className="size-4" />
          تفريغ البيانات والبدء من جديد
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive">يُمحى نهائياً</p>
            <p className="mt-1 text-xs text-muted-foreground">
              العقارات والوحدات · الملاك والمستأجرين · العقود والدفعات · المستندات المالية ·
              المصروفات والتوريدات · الاتفاقيات · المرفقات والصور
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold">يبقى</p>
            <p className="mt-1 text-xs text-muted-foreground">
              بيانات المنشأة وشعارها · الأدوار وصلاحياتها · حسابك وحسابات موظفيك ·
              سجل العمليات، وفيه قيد هذا التفريغ
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">١ — نزّل نسخة احتياطية</p>
          <p className="text-xs text-muted-foreground">
            لا رجعة بعد التفريغ. النسخة هي طريق العودة الوحيد، ولن يُفتح التأكيد قبل تنزيلها.
          </p>
          <Button variant="outline" size="sm" onClick={downloadBackup} disabled={downloading || pending}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : backedUp ? <Check className="size-4 text-emerald-600" /> : <Download className="size-4" />}
            {backedUp ? "نُزّلت — أعد التنزيل" : "تنزيل نسخة احتياطية"}
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resetPhrase" className={backedUp ? "" : "text-muted-foreground"}>
            ٢ — اكتب «{RESET_PHRASE}» للتأكيد
          </Label>
          <Input
            id="resetPhrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={!backedUp || pending}
            placeholder={RESET_PHRASE}
            className="max-w-xs"
          />
        </div>

        <Button
          variant="destructive"
          size="sm"
          disabled={!backedUp || phrase.trim() !== RESET_PHRASE || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await resetBusinessData(phrase);
              if (res.error) toast.error(res.error, { duration: 8000 });
              else {
                toast.success(res.message, { duration: 10000 });
                setPhrase("");
                setBackedUp(false);
              }
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
          تفريغ البيانات نهائياً
        </Button>
      </CardContent>
    </Card>
  );
}
