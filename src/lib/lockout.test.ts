import { describe, it, expect } from "vitest";
import { accountLock, addressLock, waitMessage, ACCOUNT_THRESHOLD, IP_THRESHOLD } from "@/lib/lockout";

const now = new Date("2026-09-01T10:00:00");
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

describe("accountLock", () => {
  it("lets a few slips pass — a mistyped password is not an attack", () => {
    expect(accountLock(ACCOUNT_THRESHOLD - 1, minutesAgo(1), now).locked).toBe(false);
  });

  it("shuts the account for a quarter of an hour on the fifth failure", () => {
    const lock = accountLock(5, minutesAgo(1), now);

    expect(lock.locked).toBe(true);
    expect(lock.minutesLeft).toBe(14);
  });

  it("opens again once the wait has passed", () => {
    expect(accountLock(5, minutesAgo(15), now).locked).toBe(false);
  });

  it("doubles the wait for each further run of failures", () => {
    expect(accountLock(10, now, now).minutesLeft).toBe(30);
    expect(accountLock(15, now, now).minutesLeft).toBe(60);
    expect(accountLock(20, now, now).minutesLeft).toBe(120);
  });

  it("stops rising at four hours, so nobody is locked out for a day", () => {
    expect(accountLock(25, now, now).minutesLeft).toBe(240);
    expect(accountLock(5000, now, now).minutesLeft).toBe(240);
  });

  it("is open for an account that has never failed", () => {
    expect(accountLock(0, null, now)).toEqual({ locked: false, until: null, minutesLeft: 0 });
  });
});

describe("addressLock", () => {
  it("ignores an address below the threshold, however many accounts it touched", () => {
    expect(addressLock(IP_THRESHOLD - 1, minutesAgo(1), now).locked).toBe(false);
  });

  it("refuses an address that sprayed many accounts without tripping any of them", () => {
    const lock = addressLock(IP_THRESHOLD, minutesAgo(2), now);

    expect(lock.locked).toBe(true);
    expect(lock.minutesLeft).toBe(13);
  });

  it("releases the address after its wait", () => {
    expect(addressLock(50, minutesAgo(15), now).locked).toBe(false);
  });
});

describe("waitMessage", () => {
  it("counts its nouns the way Arabic does", () => {
    expect(waitMessage(1)).toBe("دقيقة واحدة");
    expect(waitMessage(2)).toBe("دقيقتين");
    expect(waitMessage(7)).toBe("7 دقائق");
    expect(waitMessage(14)).toBe("14 دقيقة");
    expect(waitMessage(60)).toBe("ساعة");
    expect(waitMessage(120)).toBe("ساعتين");
    expect(waitMessage(240)).toBe("4 ساعات");
  });
});
