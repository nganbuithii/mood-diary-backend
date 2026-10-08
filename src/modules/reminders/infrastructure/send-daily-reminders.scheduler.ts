import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SendDailyRemindersUseCase } from '../application/send-daily-reminders.use-case';

@Injectable()
export class SendDailyRemindersScheduler {
  private readonly logger = new Logger(SendDailyRemindersScheduler.name);

  constructor(private readonly sendDailyRemindersUseCase: SendDailyRemindersUseCase) {}

  @Cron('0 * * * *', { name: 'send-daily-reminders', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      const { sent, failed } = await this.sendDailyRemindersUseCase.execute();
      if (sent > 0 || failed > 0) this.logger.log(`Daily reminders: ${sent} sent, ${failed} will retry`);
    } catch (error) {
      this.logger.error('Sending daily reminders failed', error instanceof Error ? error.stack : error);
    }
  }
}
