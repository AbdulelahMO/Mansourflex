"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { resetEmployeePassword } from "@/lib/actions/staff";

/**
 * The answer to a forgotten password. The new one is shown here once and never stored in
 * readable form, so it has to be handed over now — and the employee must replace it anyway.
 */
export function ResetPasswordButton({ employeeId, name }: { employeeId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [temporary, setTemporary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await resetEmployeePassword(employeeId);
      if (result.error) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      // The message carries the generated password after the last colon.
      const value = result.message?.split(": ")[1]?.split(" —")[0] ?? null;
      setTemporary(value);
    });
  }

  async function copy() {
    if (!temporary) return;
    try {
      await navigator.clipboard.writeText(temporary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The generated password is never shown again once the dialog closes.
        if (!next) {
          setTemporary(null);
          setCopied(false);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="إعادة تعيين كلمة المرور">
          <KeyRound className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>إعادة تعيين كلمة مرور {name}</AlertDialogTitle>
          <AlertDialogDescription>
            {temporary
              ? "سلّم هذه الكلمة للموظف الآن — لن تظهر مرة أخرى، وسيُطلب منه تغييرها عند أول دخول."
              : "تُلغى كلمة مروره الحالية وتُولَّد كلمة مؤقتة تُعرض لك مرة واحدة. استخدمها عند نسيانه كلمة المرور."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {temporary && (
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 p-3">
            <code className="text-base font-bold tracking-wider" dir="ltr">
              {temporary}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              {copied ? "نُسخت" : "نسخ"}
            </Button>
          </div>
        )}

        <AlertDialogFooter>
          {temporary ? (
            <AlertDialogAction>تم</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction asChild>
                <button
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    run();
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  توليد كلمة مؤقتة
                </button>
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
