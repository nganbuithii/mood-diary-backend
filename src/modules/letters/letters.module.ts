import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { CreateLetterUseCase } from './application/create-letter.use-case';
import { DeleteLetterUseCase } from './application/delete-letter.use-case';
import { ListLettersUseCase } from './application/list-letters.use-case';
import { OpenLetterUseCase } from './application/open-letter.use-case';
import { SendDueLetterEmailsUseCase } from './application/send-due-letter-emails.use-case';
import { FUTURE_LETTER_REPOSITORY } from './domain/future-letter.repository';
import { PrismaFutureLetterRepository } from './infrastructure/prisma-future-letter.repository';
import { SendLetterEmailsScheduler } from './infrastructure/send-letter-emails.scheduler';
import { LettersController } from './presentation/letters.controller';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [LettersController],
  providers: [
    CreateLetterUseCase,
    ListLettersUseCase,
    OpenLetterUseCase,
    DeleteLetterUseCase,
    SendDueLetterEmailsUseCase,
    SendLetterEmailsScheduler,
    ThrottlerGuard,
    { provide: FUTURE_LETTER_REPOSITORY, useClass: PrismaFutureLetterRepository },
  ],
})
export class LettersModule {}
