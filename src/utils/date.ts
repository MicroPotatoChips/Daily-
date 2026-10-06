export type DateInput = Date | number | string;

export function getLocalDateKey(date: Date | number = new Date()): string {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid date.');
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** Noon is safe for local calendar arithmetic through daylight-saving transitions. */
export function dateFromKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Invalid date key.');
  const [year = NaN, month = NaN, day = NaN] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setFullYear(year);
  if (getLocalDateKey(date) !== key) throw new Error('Invalid date key.');
  return date;
}

export function asDateKey(date: DateInput): string {
  if (typeof date === 'string') {
    dateFromKey(date);
    return date;
  }
  return getLocalDateKey(date);
}

export function recentDateKeys(count: number, end: DateInput = new Date()): string[] {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid day count.');
  const date = dateFromKey(asDateKey(end));
  date.setDate(date.getDate() - count + 1);
  return Array.from({ length: count }, () => {
    const key = getLocalDateKey(date);
    date.setDate(date.getDate() + 1);
    return key;
  });
}
