"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { loginAction } from "@/lib/actions/login";
import { initialActionState } from "@/lib/types";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="space-y-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">كلمة المرور</Label>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full">تسجيل الدخول</SubmitButton>
    </form>
  );
}
