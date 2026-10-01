import { Module } from '@nestjs/common';
import { MAIL_SENDER } from './domain/mail-sender';
import { NodemailerMailSender } from './infrastructure/nodemailer-mail-sender';

@Module({
  providers: [{ provide: MAIL_SENDER, useClass: NodemailerMailSender }],
  exports: [MAIL_SENDER],
})
export class MailModule {}
