export interface SendPasswordResetEmailInput {
  to: string;
  resetLink: string;
}

export interface MailSender {
  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');
