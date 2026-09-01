/**
 * Temporary passwords are generated, never chosen by the admin: the point is that nobody
 * but the account holder ends up knowing the working password. The admin sees the temporary
 * one once, hands it over, and the holder is forced to replace it on first sign-in.
 *
 * Drawn from the platform's cryptographic source rather than `Math.random`, which is seeded
 * predictably and was never meant to stand between an attacker and an account. Nothing here
 * touches the database, so the recovery script can reach it as readily as the server can.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // بلا I و O لالتباسهما بـ 1 و 0
const DIGITS = "23456789"; // بلا 0 و 1 لالتباسهما بالحروف
const SYMBOLS = "!@#$%&*";

/**
 * A uniform draw below `bound`. Plain modulo of a random word favours the low end of the range,
 * so a draw landing in the ragged remainder is thrown away and taken again. Drawn from 32 bits,
 * which covers the six-digit range as readily as a nine-letter list — a byte would not, and
 * silently never satisfies a bound above 256.
 */
function randomInt(bound: number) {
  const limit = Math.floor(0x100000000 / bound) * bound;
  const word = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(word);
    if (word[0] < limit) return word[0] % bound;
  }
}

function pick(pool: string) {
  return pool[randomInt(pool.length)];
}

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 12 characters, readable aloud over the phone, and always meeting the strength rule. */
export function generateTemporaryPassword() {
  const lower = ALPHABET.toLowerCase();
  const required = [pick(ALPHABET), pick(lower), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => pick(ALPHABET + lower + DIGITS));

  return shuffle([...required, ...rest]).join("");
}

/**
 * For an owner, who signs in once in a while and is told the password over the phone:
 * a plain word and digits, no symbols and no confusable characters. It is weak on purpose
 * and short-lived by design — the owner is forced to replace it on first sign-in.
 */
const EASY_WORDS = ["Amal", "Bayt", "Nakhl", "Noor", "Rawd", "Salam", "Waha", "Yasmin", "Zahra"];

export function generateSimplePassword() {
  const word = EASY_WORDS[randomInt(EASY_WORDS.length)];
  // Six digits, so even the shortest word clears the length rule the owner's own choice must meet.
  const digits = String(100000 + randomInt(900000));
  return `${word}${digits}`;
}

// The rule itself carries no server dependency either, so it lives beside the constants it uses —
// where the form, the server action and the tests can all reach the one copy of it.
export { PASSWORD_MIN_LENGTH, passwordError } from "@/lib/passwords-shared";
