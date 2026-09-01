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
import { Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { setAdminActive } from "@/lib/actions/staff";

/**
 * Closing an old administrator's account, or opening one again. Never deletion: the name is on
 * contracts and receipts and the audit log, and a record must keep naming somebody.
 */
export function AdminActiveButton({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await setAdminActive(id, !isActive);
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "تم");
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title={isActive ? "إيقاف الحساب" : "تفعيل الحساب"}>
          {isActive ? <PowerOff className="size-4" /> : <Power className="size-4 text-emerald-600" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? `إيقاف حساب ${name}` : `تفعيل حساب ${name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? "لن يستطيع الدخول بعدها، وتنتهي جلسته المفتوحة عند أول انتقال بين الشاشات. ويبقى اسمه على ما نفّذه من قبل."
              : "يعود الحساب للعمل بكلمة مروره السابقة. إن كانت منسيّة فأعد تعيينها بعد التفعيل."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
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
              {isActive ? "إيقاف" : "تفعيل"}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
