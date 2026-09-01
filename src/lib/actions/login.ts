"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginLock, addressFrom, normalizeEmail } from "@/lib/login-guard";
import { waitMessage } from "@/lib/lockout";
import type { ActionState } from "@/lib/types";

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      // The sign-in itself never says why it refused — it must not tell an attacker which of the
      // two things was wrong. But a locked-out employee has to be told they are waiting rather
      // than mistyping, and the wait is no secret: it applies to any address, real or invented.
      if (typeof email === "string" && email) {
        const ip = addressFrom(await headers());
        const lock = await loginLock(normalizeEmail(email), ip);
        if (lock.locked) {
          return {
            error: `تجاوزتَ عدد المحاولات المسموح بها. حاول بعد ${waitMessage(lock.minutesLeft)}.`,
          };
        }
      }
      return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
    }
    throw err;
  }
}
