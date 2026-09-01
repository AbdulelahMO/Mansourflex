import { describe, it, expect } from "vitest";
import { generateTemporaryPassword, generateSimplePassword } from "@/lib/passwords";
import { passwordError } from "@/lib/passwords-shared";

describe("generated passwords", () => {
  it("always meets the rule the holder's own choice will be measured against", () => {
    // A temporary password that the change-password screen would then reject is a dead end.
    for (let i = 0; i < 200; i++) {
      expect(passwordError(generateTemporaryPassword())).toBeNull();
      expect(passwordError(generateSimplePassword())).toBeNull();
    }
  });

  it("keeps out the characters that are misheard over a phone", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTemporaryPassword()).not.toMatch(/[IO01]/);
      expect(generateSimplePassword()).not.toMatch(/[!@#$%&*]/);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(300);
  });

  it("puts the required kinds somewhere other than the front every time", () => {
    // Unshuffled, the first four characters would always be upper, lower, digit, symbol —
    // which tells an attacker the shape of every temporary password the system issues.
    const symbolAtFour = Array.from({ length: 200 }, () => generateTemporaryPassword()).filter((p) =>
      /[!@#$%&*]/.test(p.slice(0, 4))
    );

    expect(symbolAtFour.length).toBeLessThan(200);
  });
});
