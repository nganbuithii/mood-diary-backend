import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReminderSettingsService } from './application/reminder-settings.service';
import { SendDailyRemindersUseCase } from './application/send-daily-reminders.use-case';
import { REMINDER_REPOSITORY } from './domain/reminder.repository';
import { PrismaReminderRepository } from './infrastructure/prisma-reminder.repository';
import { SendDailyRemindersScheduler } from './infrastructure/send-daily-reminders.scheduler';
import { RemindersController } from './presentation/reminders.controller';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [RemindersController],
  providers: [
    ReminderSettingsService,
    SendDailyRemindersUseCase,
    SendDailyRemindersScheduler,
    { provide: REMINDER_REPOSITORY, useClass: PrismaReminderRepository },
  ],
})
export class RemindersModule {}
