/** Bound values before they reach SQLite, JSON serialization, or calendar loops. */
export const MAX_HABIT_VALUE = 1_000_000;
export const MIN_HABIT_VALUE = 0.000001;
export const VALUE_EPSILON = 1e-9;

export function assertTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 253_402_214_400_000) {
    throw new Error('Invalid timestamp.');
  }
}
