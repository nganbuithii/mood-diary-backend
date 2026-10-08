export const DEFAULT_REMINDER_HOUR = 20;

export interface ReminderSettings {
  enabled: boolean;
  /** Local hour (0-23) in `timeZone`. */
  hour: number;
  /** IANA zone name, e.g. "Asia/Ho_Chi_Minh". */
  timeZone: string;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
