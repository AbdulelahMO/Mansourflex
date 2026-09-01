import { describe, it, expect } from "vitest";
import { passwordError, PASSWORD_MIN_LENGTH } from "@/lib/passwords-shared";

describe("passwordError", () => {
  it("accepts a password that is long enough and mixed", () => {
    expect(passwordError("Marsa48Qamar")).toBeNull();
  });

  it("refuses one shorter than the rule", () => {
    expect(passwordError("Ab3defgh")).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("still requires a letter and a digit", () => {
    expect(passwordError("1234567890")).not.toBeNull();
    expect(passwordError("abcdefghij")).not.toBeNull();
  });

  it("refuses the passwords a guessing script starts with", () => {
    // Long enough and mixed, and the first thing anyone would try.
    expect(passwordError("password123")).toBe("كلمة المرور شائعة ويسهل تخمينها — اختر غيرها");
    expect(passwordError("Password1234")).toBe("كلمة المرور شائعة ويسهل تخمينها — اختر غيرها");
    expect(passwordError("flex2026kk")).toBe("كلمة المرور شائعة ويسهل تخمينها — اختر غيرها");
  });

  it("refuses a password built from the person's own address", () => {
    expect(passwordError("mansour2026x", "mansour@flexksa.co")).toBe("كلمة المرور تحتوي على بريدك — اختر غيرها");
  });

  it("does not read a two or three letter address into an unrelated password", () => {
    // «ali» is too short to mean anything inside a password; refusing on it would reject
    // half of what anyone types.
    expect(passwordError("Marsa48Qamar", "ali@flexksa.co")).toBeNull();
  });

  it("judges the password alone when no address is given", () => {
    expect(passwordError("Marsa48Qamar")).toBeNull();
  });
});
