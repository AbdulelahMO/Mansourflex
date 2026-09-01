"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/form-dialog";
import { createAdmin } from "@/lib/actions/staff";
import { ShieldPlus } from "lucide-react";

/**
 * A second administrator is not a convenience — it is the way back in. One admin means one
 * forgotten password away from needing the server itself, and the dialog says so plainly rather
 * than leaving the reason to be discovered on the day it is needed.
 */
export function AdminDialog() {
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <ShieldPlus className="size-4" />
          إضافة مدير
        </Button>
      }
      title="إضافة مدير نظام"
      description="صلاحية كاملة بلا قيد ولا مراجعة. يولّد النظام كلمة مرور مؤقتة تُعرض مرة واحدة، ويُلزَم صاحبها بتغييرها عند أول دخول."
      action={createAdmin}
      submitLabel="إضافة"
    >
      <div className="space-y-1.5">
        <Label htmlFor="admin-name">
          الاسم <span className="text-destructive">*</span>
        </Label>
        <Input id="admin-name" name="name" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-email">
          البريد الإلكتروني <span className="text-destructive">*</span>
        </Label>
        <Input id="admin-email" name="email" type="email" required dir="ltr" autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-phone">الجوال</Label>
        <Input id="admin-phone" name="phone" dir="ltr" autoComplete="off" />
      </div>

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        المدير يرى كل شيء ويفعل كل شيء، ولا تُرفع إجراءاته لموافقة أحد. ويُنصح بمديرَين لا أكثر: أحدهما
        يعيد تعيين كلمة مرور الآخر عند نسيانها، فلا يُحتاج إلى الخادم.
      </p>
    </FormDialog>
  );
}
