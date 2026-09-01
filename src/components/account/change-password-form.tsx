"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { changeOwnPassword } from "@/lib/actions/account";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwords-shared";
import { initialActionState } from "@/lib/types";
import { toast } from "sonner";

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const router = useRouter();
  const [state, formAction] = useActionState(changeOwnPassword, initialActionState);

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
      // A forced change ends here: the rest of the app opens up once it is done.
      if (forced) router.replace("/");
    }
  }, [state, forced, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">
          كلمة المرور الحالية <span className="text-destructive">*</span>
        </Label>
        <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">
          كلمة المرور الجديدة <span className="text-destructive">*</span>
        </Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          {PASSWORD_MIN_LENGTH} أحرف على الأقل، وتحتوي على حرف ورقم، ولا تكون كلمة شائعة أو مأخوذة من بريدك
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">
          تأكيد كلمة المرور <span className="text-destructive">*</span>
        </Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      )}

      <SubmitButton>حفظ كلمة المرور</SubmitButton>
    </form>
  );
}
