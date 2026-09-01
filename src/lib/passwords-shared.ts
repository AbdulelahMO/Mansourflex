/** Shared with client components, so the form and the server never disagree on the rule. */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * The passwords an attacker tries first. A rule that only counts characters lets «Password12»
 * through, and a list of a few thousand common words is what a guessing script starts from —
 * so the ones that keep appearing at the top of it are refused by name.
 */
export const COMMON_PASSWORDS = [
  "password", "password1", "password12", "password123", "passw0rd", "p@ssword",
  "12345678", "123456789", "1234567890", "0123456789", "qwerty", "qwertyuiop",
  "abc123456", "iloveyou", "admin", "administrator", "welcome", "letmein",
  "changeme", "sunshine", "princess", "football", "monkey", "dragon",
  "flex2026", "flex1234", "riyadh123", "saudi123", "aa123456", "asdfghjkl",
];

/**
 * The one rule, applied wherever a password is set, so the messages never disagree.
 *
 * Length alone is a weak rule: what a guessing script tries first is not random strings but the
 * few thousand passwords people actually choose, and the address of the person choosing. Both
 * are refused here — the wait between attempts buys time only if the password is not the first
 * thing tried.
 */
export function passwordError(password: string, email?: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `كلمة المرور لا تقل عن ${PASSWORD_MIN_LENGTH} أحرف`;
  if (!/[A-Za-z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل";
  if (!/\d/.test(password)) return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";

  const plain = password.toLowerCase();
  if (COMMON_PASSWORDS.some((common) => plain === common || plain.startsWith(common))) {
    return "كلمة المرور شائعة ويسهل تخمينها — اختر غيرها";
  }

  // The name in the address is the first thing a guess is built from.
  const local = email?.toLowerCase().split("@")[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  if (local.length >= 4 && plain.includes(local)) {
    return "كلمة المرور تحتوي على بريدك — اختر غيرها";
  }

  return null;
}
