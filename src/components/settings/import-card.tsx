"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, TriangleAlert, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reviewImport, type ImportState } from "@/lib/actions/import";

const LABELS: Record<string, string> = {
  owners: "مالك",
  buildings: "عقار",
  units: "وحدة",
  tenants: "مستأجر",
  contracts: "عقد",
};

/**
 * Bringing an existing portfolio in.
 *
 * The file is read twice by design: once to say what it would do, and once to do it. Nothing is
 * committed while a single cell is faulted, and every fault names its sheet, row and column —
 * an importer that says «الملف غير صالح» sends the operator back to typing two hundred contracts
 * by hand, which is the very thing it exists to spare them.
 */
export function ImportCard() {
  const [state, formAction] = useActionState(reviewImport, {} as ImportState);
  const [downloading, setDownloading] = useState(false);
  // The chosen file is held here rather than left in the input: React clears an uncontrolled
  // form after an action, so after the dry run the operator would have to pick the file again
  // before they could commit it — with the review they just read still on the screen.
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (commit: "yes" | "no") => {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("commit", commit);
    startTransition(() => formAction(data));
  };

  async function downloadTemplate() {
    setDownloading(true);
    try {
      const res = await fetch("/api/import/template");
      if (!res.ok) {
        toast.error("تعذّر تنزيل القالب");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "قالب-الاستيراد.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
    } finally {
      setDownloading(false);
    }
  }

  const plan = state.plan;
  const total = plan ? Object.values(plan.counts).reduce((a, b) => a + b, 0) : 0;
  const clean = plan && plan.issues.length === 0 && total > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4" />
          استيراد من ملف Excel
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          لإدخال محفظة قائمة دفعة واحدة: الملاك والعقارات والوحدات والمستأجرين والعقود. تُولَّد أقساط كل
          عقد تلقائياً من مدته ودوريته، وأرقام العقود يمنحها النظام.
        </p>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">١ — نزّل القالب واملأه</p>
          <p className="text-xs text-muted-foreground">
            خمس أوراق. الأعمدة المعلَّمة بنجمة مطلوبة، والأوراق تتنادى بالأسماء: العقار يذكر اسم مالكه،
            والعقد يذكر عقاره ووحدته ومستأجره.
          </p>
          <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            تنزيل القالب
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="importFile">٢ — ارفع الملف بعد تعبئته</Label>
            <Input
              id="importFile"
              type="file"
              accept=".xlsx"
              className="max-w-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!file || pending} onClick={() => submit("no")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              فحص الملف
            </Button>

            {clean && (
              <Button disabled={pending} onClick={() => submit("yes")}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                استيراد {total} سجلاً
              </Button>
            )}
          </div>
        </div>

        {state.committed && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            <Check className="size-4 shrink-0" />
            تم الاستيراد — راجع القوائم للتأكد قبل أن تبني عليها.
          </p>
        )}

        {plan && !state.committed && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(plan.counts).map(([key, count]) => (
                <span
                  key={key}
                  className={
                    "rounded px-2 py-1 text-xs font-medium " +
                    (count > 0 ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground")
                  }
                >
                  {count} {LABELS[key]}
                </span>
              ))}
            </div>

            {plan.issues.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <TriangleAlert className="size-4" />
                  {plan.issues.length} خطأ يمنع الاستيراد — صحّحها في الملف وأعد الفحص
                </p>
                <div className="max-h-60 overflow-y-auto rounded border bg-muted/30">
                  {plan.issues.slice(0, 100).map((issue, i) => (
                    <p key={i} className="border-b px-2.5 py-1.5 text-xs last:border-0">
                      <span className="font-medium">{issue.sheet}</span>
                      <span className="text-muted-foreground"> · صف {issue.row} · </span>
                      <span className="font-medium">{issue.column}</span>
                      <span className="text-muted-foreground"> — {issue.message}</span>
                    </p>
                  ))}
                  {plan.issues.length > 100 && (
                    <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                      و{plan.issues.length - 100} خطأ آخر
                    </p>
                  )}
                </div>
              </div>
            )}

            {plan.skipped.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{plan.skipped.length} صفاً سيُتخطّى لوجوده مسبقاً</p>
                <div className="max-h-40 overflow-y-auto rounded border bg-muted/30">
                  {plan.skipped.slice(0, 50).map((s, i) => (
                    <p key={i} className="border-b px-2.5 py-1.5 text-xs text-muted-foreground last:border-0">
                      {s.sheet} · صف {s.row} — {s.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {plan.issues.length === 0 && total === 0 && (
              <p className="text-sm text-muted-foreground">لا يوجد في الملف جديد يُستورد.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
