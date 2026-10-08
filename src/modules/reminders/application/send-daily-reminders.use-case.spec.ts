import { ConfigService } from '@nestjs/config';
import {
  MailSender,
  SendDailyReminderEmailInput,
} from '../../mail/domain/mail-sender';
import { ReminderRecipient, ReminderRepository } from '../domain/reminder.repository';
import { ReminderSettings } from '../domain/reminder-settings';
import { SendDailyRemindersUseCase } from './send-daily-reminders.use-case';

// 2026-10-08 13:30 UTC = 20:30 in Ho Chi Minh City (UTC+7).
const NOW = new Date('2026-10-08T13:30:00.000Z');
const HCM_TODAY = new Date('2026-10-08T00:00:00.000Z');

function buildRecipient(overrides: Partial<ReminderRecipient> = {}): ReminderRecipient {
  return {
    userId: 'user-1',
    email: 'ngan@example.com',
    displayName: 'Ngân',
    settings: { enabled: true, hour: 20, timeZone: 'Asia/Ho_Chi_Minh' },
    reminderSentOn: null,
    ...overrides,
  };
}

class InMemoryReminderRepository implements ReminderRepository {
  public entryDays = new Map<string, Date[]>();

  constructor(private readonly recipients: ReminderRecipient[]) {}

  findSettings(): Promise<ReminderSettings | null> {
    throw new Error('not used in daily reminder tests');
  }

  updateSettings(): Promise<ReminderSettings | null> {
    throw new Error('not used in daily reminder tests');
  }

  findEnabled(take: number, afterUserId?: string): Promise<ReminderRecipient[]> {
    return Promise.resolve(
      this.recipients
        .filter((recipient) => recipient.settings.enabled && (!afterUserId || recipient.userId > afterUserId))
        .sort((a, b) => a.userId.localeCompare(b.userId))
        .slice(0, take)
        .map((recipient) => ({ ...recipient })),
    );
  }

  hasLiveEntryOn(userId: string, day: Date): Promise<boolean> {
    return Promise.resolve((this.entryDays.get(userId) ?? []).some((entryDay) => entryDay.getTime() === day.getTime()));
  }

  claimDay(userId: string, day: Date): Promise<boolean> {
    const recipient = this.byId(userId);
    if (recipient.reminderSentOn?.getTime() === day.getTime()) return Promise.resolve(false);
    recipient.reminderSentOn = day;
    return Promise.resolve(true);
  }

  releaseDay(userId: string, day: Date, previous: Date | null): Promise<void> {
    const recipient = this.byId(userId);
    if (recipient.reminderSentOn?.getTime() === day.getTime()) recipient.reminderSentOn = previous;
    return Promise.resolve();
  }

  sentOn(userId: string): Date | null {
    return this.byId(userId).reminderSentOn;
  }

  private byId(userId: string): ReminderRecipient {
    const recipient = this.recipients.find((r) => r.userId === userId);
    if (!recipient) throw new Error(`unknown user ${userId}`);
    return recipient;
  }
}

class FakeMailSender implements MailSender {
  public sent: SendDailyReminderEmailInput[] = [];
  public failFor = new Set<string>();

  sendPasswordResetEmail(): Promise<void> {
    throw new Error('not used in daily reminder tests');
  }

  sendLetterReadyEmail(): Promise<void> {
    throw new Error('not used in daily reminder tests');
  }

  sendDailyReminderEmail(input: SendDailyReminderEmailInput): Promise<void> {
    if (this.failFor.has(input.to)) return Promise.reject(new Error('smtp down'));
    this.sent.push(input);
    return Promise.resolve();
  }
}

function setup(recipients: ReminderRecipient[]) {
  const repository = new InMemoryReminderRepository(recipients);
  const mailSender = new FakeMailSender();
  const config = { get: (_key: string, fallback?: string) => fallback } as unknown as ConfigService;
  return { repository, mailSender, useCase: new SendDailyRemindersUseCase(repository, mailSender, config) };
}

describe('SendDailyRemindersUseCase', () => {
  it('sends once the local hour has reached the chosen hour and marks the local day', async () => {
    const { repository, mailSender, useCase } = setup([buildRecipient()]);

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mailSender.sent).toEqual([
      {
        to: 'ngan@example.com',
        displayName: 'Ngân',
        writeLink: 'http://localhost:3000/home',
        settingsLink: 'http://localhost:3000/profile',
      },
    ]);
    expect(repository.sentOn('user-1')).toEqual(HCM_TODAY);
  });

  it('waits until the chosen hour in the user’s own time zone', async () => {
    const { mailSender, useCase } = setup([buildRecipient({ settings: { enabled: true, hour: 21, timeZone: 'Asia/Ho_Chi_Minh' } })]);

    await useCase.execute(NOW);

    expect(mailSender.sent).toHaveLength(0);
  });

  it('still sends later the same day when the exact hour was missed', async () => {
    const { mailSender, useCase } = setup([buildRecipient({ settings: { enabled: true, hour: 8, timeZone: 'Asia/Ho_Chi_Minh' } })]);

    await useCase.execute(NOW);

    expect(mailSender.sent).toHaveLength(1);
  });

  it('never sends twice on the same local day', async () => {
    const { mailSender, useCase } = setup([buildRecipient()]);

    await useCase.execute(NOW);
    await useCase.execute(new Date(NOW.getTime() + 60 * 60 * 1000));

    expect(mailSender.sent).toHaveLength(1);
  });

  it('skips users who already wrote today', async () => {
    const { repository, mailSender, useCase } = setup([buildRecipient()]);
    repository.entryDays.set('user-1', [HCM_TODAY]);

    await useCase.execute(NOW);

    expect(mailSender.sent).toHaveLength(0);
    expect(repository.sentOn('user-1')).toBeNull();
  });

  it('releases the day after a failed send so the next run retries', async () => {
    const yesterday = new Date('2026-10-07T00:00:00.000Z');
    const { repository, mailSender, useCase } = setup([buildRecipient({ reminderSentOn: yesterday })]);
    mailSender.failFor.add('ngan@example.com');

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(repository.sentOn('user-1')).toEqual(yesterday);
  });
});
