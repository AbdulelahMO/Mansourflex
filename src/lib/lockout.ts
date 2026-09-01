/**
 * How long a sign-in is refused after repeated failures.
 *
 * The password is the only thing standing between the internet and every owner, tenant and
 * contract in the system, and a guess costs the attacker nothing: a script tries thousands a
 * minute until one lands. Making each failure buy the next attempt a longer wait turns days of
 * guessing into years of it, while a member of staff who mistyped waits a quarter of an hour.
 *
 * The arithmetic is kept apart from the records it reads so it can be stated and checked alone.
 */

/** Failures on one account before it is shut for a while. */
export const ACCOUNT_THRESHOLD = 5;

/** Each further run of failures buys a longer wait — in minutes, the last repeating. */
export const LOCK_STEPS = [15, 30, 60, 120, 240];

/** Failures from one address across any accounts before the address itself is refused. */
export const IP_THRESHOLD = 20;
export const IP_WINDOW_MINUTES = 15;
export const IP_LOCK_MINUTES = 15;

export type LockState = {
  locked: boolean;
  /** When the wait ends — null when nothing is locked. */
  until: Date | null;
  /** Whole minutes still to wait, rounded up, so a message never says «0 minutes». */
  minutesLeft: number;
};

const OPEN: LockState = { locked: false, until: null, minutesLeft: 0 };

function stateFrom(until: Date, now: Date): LockState {
  if (until <= now) return OPEN;
  return { locked: true, until, minutesLeft: Math.ceil((until.getTime() - now.getTime()) / 60_000) };
}

/**
 * The account's own wait, counted from its last failure: five failures buy a quarter of an hour,
 * ten buy half, and so on to a ceiling of four hours — long enough to make guessing hopeless,
 * short enough that a locked-out employee is not sent home.
 */
export function accountLock(consecutiveFailures: number, lastFailureAt: Date | null, now: Date): LockState {
  if (!lastFailureAt || consecutiveFailures < ACCOUNT_THRESHOLD) return OPEN;

  const step = Math.min(Math.floor(consecutiveFailures / ACCOUNT_THRESHOLD) - 1, LOCK_STEPS.length - 1);
  const until = new Date(lastFailureAt.getTime() + LOCK_STEPS[step] * 60_000);
  return stateFrom(until, now);
}

/**
 * The address's wait. Locking accounts alone leaves the door open to spraying — one guess each
 * against two hundred addresses, never enough on any single account to trip its lock — so the
 * source is counted too, whatever accounts it was aiming at.
 */
export function addressLock(failuresInWindow: number, lastFailureAt: Date | null, now: Date): LockState {
  if (!lastFailureAt || failuresInWindow < IP_THRESHOLD) return OPEN;

  const until = new Date(lastFailureAt.getTime() + IP_LOCK_MINUTES * 60_000);
  return stateFrom(until, now);
}

/** Wording for the wait, in Arabic that counts its own nouns. */
export function waitMessage(minutes: number) {
  if (minutes <= 1) return "دقيقة واحدة";
  if (minutes === 2) return "دقيقتين";
  if (minutes <= 10) return `${minutes} دقائق`;
  if (minutes < 60) return `${minutes} دقيقة`;

  const hours = Math.ceil(minutes / 60);
  if (hours === 1) return "ساعة";
  if (hours === 2) return "ساعتين";
  if (hours <= 10) return `${hours} ساعات`;
  return `${hours} ساعة`;
}
