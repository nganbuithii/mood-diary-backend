import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SendDueLetterEmailsUseCase } from '../application/send-due-letter-emails.use-case';

@Injectable()
export class SendLetterEmailsScheduler {
  private readonly logger = new Logger(SendLetterEmailsScheduler.name);

  constructor(private readonly sendDueLetterEmailsUseCase: SendDueLetterEmailsUseCase) {}

  @Cron('5 * * * *', { name: 'send-letter-ready-emails', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      const { sent, failed } = await this.sendDueLetterEmailsUseCase.execute();
      if (sent > 0 || failed > 0) this.logger.log(`Letter emails: ${sent} sent, ${failed} will retry`);
    } catch (error) {
      this.logger.error('Sending letter emails failed', error instanceof Error ? error.stack : error);
    }
  }
}
