import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { LocalDateOutOfRangeError } from '../domain/local-date-out-of-range.error';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseCalendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidEntryDateError(value);
  }
  return date;
}

export function parseLocalToday(value: string, now: Date): Date {
  const today = parseCalendarDate(value);
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (Math.abs(today.getTime() - utcToday) > DAY_MS) {
    throw new LocalDateOutOfRangeError(value);
  }
  return today;
}

export function monthRange(month: string): { from: Date; to: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1)),
  };
}
