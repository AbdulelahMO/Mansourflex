"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createOwnerInline, type OwnerActionState } from "@/lib/actions/owners";
import { Plus } from "lucide-react";

const initialState: OwnerActionState = {};

const OWNER_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "فرد" },
  { value: "COMPANY", label: "شركة / مؤسسة" },
];

export function AddOwnerInlineDialog({ onCreated }: { onCreated: (owner: { id: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createOwnerInline, initialState);
  const [ownerType, setOwnerType] = useState("");
  const isCompany = ownerType === "COMPANY";

  useEffect(() => {
    if (state.success && state.owner) {
      onCreated(state.owner);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" title="إضافة مالك جديد">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة مالك جديد</DialogTitle>
          <DialogDescription>
            يمكنك إكمال باقي البيانات لاحقاً (كالعنوان الوطني، رقم جوال آخر، وبيانات إضافية) من صفحة الملاك
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ownerQuickType">نوع المالك</Label>
            <Select name="ownerType" value={ownerType} onValueChange={(v) => v && setOwnerType(v)}>
              <SelectTrigger className="w-full" id="ownerQuickType">
                <SelectValue placeholder="اختر نوع المالك" />
              </SelectTrigger>
              <SelectContent>
                {OWNER_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerQuickName">
              الاسم<span className="text-destructive"> *</span>
            </Label>
            <Input id="ownerQuickName" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ownerQuickPhone">
                الجوال<span className="text-destructive"> *</span>
              </Label>
              <Input id="ownerQuickPhone" name="phone" dir="ltr" required pattern="\d{10}" title="يتكون من 10 أرقام" />
            </div>
            {isCompany ? (
              <div className="space-y-1.5">
                <Label htmlFor="ownerQuickUnifiedNumber">
                  الرقم الموحد<span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="ownerQuickUnifiedNumber"
                  name="unifiedNumber"
                  dir="ltr"
                  required
                  pattern="700\d{7}"
                  title="يبدأ بـ700 ويتكون من 10 أرقام"
                  placeholder="700xxxxxxx"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ownerQuickNationalId">
                  رقم الهوية<span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="ownerQuickNationalId"
                  name="nationalId"
                  dir="ltr"
                  required
                  pattern="\d{10}"
                  title="يتكون من 10 أرقام"
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerQuickEmail">
              البريد الإلكتروني<span className="text-destructive"> *</span>
            </Label>
            <Input id="ownerQuickEmail" name="email" type="email" required dir="ltr" />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" aria-live="polite">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>إضافة</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
