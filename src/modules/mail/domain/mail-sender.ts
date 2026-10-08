export interface SendPasswordResetEmailInput {
  to: string;
  resetLink: string;
}

export interface SendLetterReadyEmailInput {
  to: string;
  openLink: string;
  sealedAgo: string;
}

export interface SendDailyReminderEmailInput {
  to: string;
  displayName: string;
  writeLink: string;
  settingsLink: string;
}

export interface MailSender {
  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void>;
  sendLetterReadyEmail(input: SendLetterReadyEmailInput): Promise<void>;
  sendDailyReminderEmail(input: SendDailyReminderEmailInput): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');
