import "server-only";

/**
 * Temporary passwords are generated, never chosen by the admin: the point is that nobody
 * but the account holder ends up knowing the working password. The admin sees the temporary
 * one once, hands it over, and the holder is forced to replace it on first sign-in.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // بلا I و O لالتباسهما بـ 1 و 0
const DIGITS = "23456789"; // بلا 0 و 1 لالتباسهما بالحروف
const SYMBOLS = "!@#$%&*";

function pick(pool: string) {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 12 characters, readable aloud over the phone, and always meeting the strength rule. */
export function generateTemporaryPassword() {
  const lower = ALPHABET.toLowerCase();
  const required = [pick(ALPHABET), pick(lower), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => pick(ALPHABET + lower + DIGITS));

  return [...required, ...rest]
    .map((c) => ({ c, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.c)
    .join("");
}

export { PASSWORD_MIN_LENGTH } from "@/lib/passwords-shared";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwords-shared";

/** The one rule, applied wherever a password is set, so the messages never disagree. */
export function passwordError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `كلمة المرور لا تقل عن ${PASSWORD_MIN_LENGTH} أحرف`;
  if (!/[A-Za-z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل";
  if (!/\d/.test(password)) return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  return null;
}
