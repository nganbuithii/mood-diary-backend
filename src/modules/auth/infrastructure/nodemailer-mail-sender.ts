import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailSender, SendPasswordResetEmailInput } from '../domain/mail-sender';

@Injectable()
export class NodemailerMailSender implements MailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT'),
      secure: config.get<number>('SMTP_PORT') === 465,
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASSWORD'),
      },
    });
    this.from = config.get<string>('MAIL_FROM', 'no-reply@mood-diary.app');
  }

  async sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'Reset your Mood Diary password',
      text: `Open this link to reset your password: ${input.resetLink}\n\nThis link expires soon and can only be used once. If you didn't request this, you can ignore this email.`,
      html: `<p>Open this link to reset your password:</p><p><a href="${input.resetLink}">${input.resetLink}</a></p><p>This link expires soon and can only be used once. If you didn't request this, you can ignore this email.</p>`,
    });
  }
}
