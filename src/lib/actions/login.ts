"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
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
      return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
    }
    throw err;
  }
}
