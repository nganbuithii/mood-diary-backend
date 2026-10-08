import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import {
  MailSender,
  SendDailyReminderEmailInput,
  SendLetterReadyEmailInput,
  SendPasswordResetEmailInput,
} from '../domain/mail-sender';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

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

  async sendLetterReadyEmail(input: SendLetterReadyEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'A letter from your past self has arrived 💌',
      text: `The letter you sealed ${input.sealedAgo} is ready to open.

Open it here: ${input.openLink}

Only you can read it, inside Mood Diary.`,
      html: `<p>The letter you sealed <strong>${input.sealedAgo}</strong> is ready to open.</p><p><a href="${input.openLink}">Open your letter</a></p><p>Only you can read it, inside Mood Diary.</p>`,
    });
  }

  async sendDailyReminderEmail(input: SendDailyReminderEmailInput): Promise<void> {
    const name = escapeHtml(input.displayName);
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: 'How are you feeling today? ♡',
      text: `Hi ${input.displayName},

Your diary is saving a little space for today. Take a moment to note how you feel: ${input.writeLink}

You can change or turn off this reminder in your profile: ${input.settingsLink}`,
      html: `<p>Hi ${name},</p><p>Your diary is saving a little space for today. Take a moment to note how you feel ♡</p><p><a href="${input.writeLink}">Write today's page</a></p><p style="color:#888;font-size:12px">You can change or turn off this reminder in <a href="${input.settingsLink}">your profile</a>.</p>`,
    });
  }
}
