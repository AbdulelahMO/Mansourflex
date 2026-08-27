"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A password field with a reveal toggle — typing a password blind is where most sign-in
 * failures come from, and a generated temporary password is nearly impossible to type
 * correctly without seeing it.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        dir="ltr"
        className={cn("pe-10", className)}
        aria-describedby={hintId}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Sits on the left in this RTL layout, inside the field.
        className="absolute inset-y-0 start-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        title={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <span id={hintId} className="sr-only">
        اضغط الزر لإظهار كلمة المرور أو إخفائها
      </span>
    </div>
  );
}
