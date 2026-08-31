/**
 * Unit numbers, generated from a pattern instead of typed one at a time.
 *
 * Shared by the form that previews them and the action that creates them, so what the operator
 * is shown before committing is the very list that gets written — not a second implementation
 * that agrees with the first until the day it does not.
 */
export type NumberingMode = "floors" | "sequential";

export type NumberingInput = {
  mode: NumberingMode;
  /** floors mode */
  floors?: number;
  perFloor?: number;
  /** Where the first floor's numbers start: 1 gives 101…, 0 gives 001… for a ground floor. */
  firstFloor?: number;
  /** sequential mode */
  count?: number;
  startFrom?: number;
  prefix?: string;
};

/** A ceiling, so a mistyped «300 طوابق» cannot write thousands of rows before anyone notices. */
export const MAX_BULK_UNITS = 200;

export function buildUnitNumbers(input: NumberingInput): { unitNumber: string; floor: string | null }[] {
  const out: { unitNumber: string; floor: string | null }[] = [];

  if (input.mode === "floors") {
    const floors = Math.max(0, Math.floor(input.floors ?? 0));
    const perFloor = Math.max(0, Math.floor(input.perFloor ?? 0));
    const first = Math.floor(input.firstFloor ?? 1);

    for (let f = first; f < first + floors; f++) {
      for (let i = 1; i <= perFloor; i++) {
        if (out.length >= MAX_BULK_UNITS) return out;
        // 1 → 101, 0 → 001: the floor carries into the number as it does on the doors.
        out.push({ unitNumber: `${f}${String(i).padStart(2, "0")}`, floor: String(f) });
      }
    }
    return out;
  }

  const count = Math.max(0, Math.floor(input.count ?? 0));
  const start = Math.floor(input.startFrom ?? 1);
  const prefix = (input.prefix ?? "").trim();

  for (let i = 0; i < count && out.length < MAX_BULK_UNITS; i++) {
    out.push({ unitNumber: `${prefix}${start + i}`, floor: null });
  }
  return out;
}
