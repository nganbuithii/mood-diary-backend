import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SENDER, MailSender } from '../../mail/domain/mail-sender';
import { FUTURE_LETTER_REPOSITORY, FutureLetterRepository } from '../domain/future-letter.repository';

const BATCH_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export function sealedAgo(createdAt: Date, now: Date): string {
  const days = Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / DAY_MS));
  if (days < 45) return relative.format(-days, 'day');
  if (days < 330) return relative.format(-Math.round(days / 30.44), 'month');
  return relative.format(-Math.round(days / 365.25), 'year');
}

export interface SendDueLetterEmailsResult {
  sent: number;
  failed: number;
}

// In-app unlocking never waits for this: a letter is readable as soon as deliverAt passes.
// This only sends the "your letter has arrived" email, without the letter's words.
@Injectable()
export class SendDueLetterEmailsUseCase {
  private readonly logger = new Logger(SendDueLetterEmailsUseCase.name);

  constructor(
    @Inject(FUTURE_LETTER_REPOSITORY) private readonly letterRepository: FutureLetterRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    private readonly config: ConfigService,
  ) {}

  async execute(now: Date = new Date()): Promise<SendDueLetterEmailsResult> {
    const baseUrl = this.config.get<string>('FRONTEND_LETTERS_URL', 'http://localhost:3000/letters');
    const result: SendDueLetterEmailsResult = { sent: 0, failed: 0 };

    let afterId: string | undefined;
    for (;;) {
      const batch = await this.letterRepository.findDueForEmail(now, BATCH_SIZE, afterId);
      for (const { letter, email } of batch) {
        if (!(await this.letterRepository.claimEmail(letter.id, now))) continue;
        try {
          await this.mailSender.sendLetterReadyEmail({
            to: email,
            openLink: `${baseUrl}/${letter.id}`,
            sealedAgo: sealedAgo(letter.createdAt, now),
          });
          result.sent++;
        } catch (error) {
          await this.letterRepository.releaseEmailClaim(letter.id);
          this.logger.warn(
            `Letter ${letter.id}: email failed, will retry (${error instanceof Error ? error.message : 'unknown error'})`,
          );
          result.failed++;
        }
      }
      if (batch.length < BATCH_SIZE) break;
      afterId = batch[batch.length - 1].letter.id;
    }

    return result;
  }
}
