import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SENDER, MailSender } from '../../mail/domain/mail-sender';
import { REMINDER_REPOSITORY, ReminderRecipient, ReminderRepository } from '../domain/reminder.repository';
import { localTimeIn } from './local-time';

const BATCH_SIZE = 100;

export interface SendDailyRemindersResult {
  sent: number;
  failed: number;
}

// Runs hourly. "At or after the chosen hour" rather than "exactly at it", so a run missed
// while the server slept still sends later the same local day.
@Injectable()
export class SendDailyRemindersUseCase {
  private readonly logger = new Logger(SendDailyRemindersUseCase.name);

  constructor(
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepository: ReminderRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    private readonly config: ConfigService,
  ) {}

  async execute(now: Date = new Date()): Promise<SendDailyRemindersResult> {
    const appUrl = this.config.get<string>('FRONTEND_APP_URL', 'http://localhost:3000');
    const result: SendDailyRemindersResult = { sent: 0, failed: 0 };

    let afterUserId: string | undefined;
    for (;;) {
      const batch = await this.reminderRepository.findEnabled(BATCH_SIZE, afterUserId);
      for (const recipient of batch) {
        const outcome = await this.remind(recipient, now, appUrl);
        if (outcome === 'sent') result.sent++;
        if (outcome === 'failed') result.failed++;
      }
      if (batch.length < BATCH_SIZE) break;
      afterUserId = batch[batch.length - 1].userId;
    }

    return result;
  }

  private async remind(
    recipient: ReminderRecipient,
    now: Date,
    appUrl: string,
  ): Promise<'sent' | 'failed' | 'skipped'> {
    const { day, hour } = localTimeIn(recipient.settings.timeZone, now);
    if (hour < recipient.settings.hour) return 'skipped';
    if (recipient.reminderSentOn?.getTime() === day.getTime()) return 'skipped';
    if (await this.reminderRepository.hasLiveEntryOn(recipient.userId, day)) return 'skipped';
    if (!(await this.reminderRepository.claimDay(recipient.userId, day))) return 'skipped';

    try {
      await this.mailSender.sendDailyReminderEmail({
        to: recipient.email,
        displayName: recipient.displayName,
        writeLink: `${appUrl}/home`,
        settingsLink: `${appUrl}/profile`,
      });
      return 'sent';
    } catch (error) {
      await this.reminderRepository.releaseDay(recipient.userId, day, recipient.reminderSentOn);
      this.logger.warn(
        `Reminder for user ${recipient.userId}: email failed, will retry (${error instanceof Error ? error.message : 'unknown error'})`,
      );
      return 'failed';
    }
  }
}
