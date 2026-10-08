import { ReminderSettings } from './reminder-settings';

export interface ReminderRecipient {
  userId: string;
  email: string;
  displayName: string;
  settings: ReminderSettings;
  /** Local calendar day (UTC midnight) the last reminder went out, or null. */
  reminderSentOn: Date | null;
}

export interface ReminderRepository {
  findSettings(userId: string): Promise<ReminderSettings | null>;
  /** Returns null when the user no longer exists. */
  updateSettings(userId: string, settings: ReminderSettings): Promise<ReminderSettings | null>;
  /** Users with reminders on, ordered by id for cursor paging. */
  findEnabled(take: number, afterUserId?: string): Promise<ReminderRecipient[]>;
  hasLiveEntryOn(userId: string, day: Date): Promise<boolean>;
  /** Marks `day` as sent unless it already was; false means another run got there first. */
  claimDay(userId: string, day: Date): Promise<boolean>;
  /** Undoes a claim after a failed send, restoring the previous value. */
  releaseDay(userId: string, day: Date, previous: Date | null): Promise<void>;
}

export const REMINDER_REPOSITORY = Symbol('REMINDER_REPOSITORY');
