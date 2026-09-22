import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { RESET_TOKEN_ISSUER, ResetTokenIssuer } from '../domain/reset-token-issuer';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';
import { MAIL_SENDER, MailSender } from '../domain/mail-sender';

export interface ForgotPasswordInput {
  email: string;
}

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(RESET_TOKEN_ISSUER) private readonly resetTokenIssuer: ResetTokenIssuer,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly resetTokenRepository: PasswordResetTokenRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    private readonly config: ConfigService,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Same (no-op) outcome whether or not the email exists — the controller
      // always returns the same generic message, so this must not leak
      // account existence via a different response or side effect.
      return;
    }

    await this.resetTokenRepository.invalidateAllForUser(user.id);

    const generated = this.resetTokenIssuer.generate();
    await this.resetTokenRepository.create({
      userId: user.id,
      tokenHash: generated.tokenHash,
      expiresAt: generated.expiresAt,
    });

    const baseUrl = this.config.get<string>('FRONTEND_RESET_PASSWORD_URL', 'http://localhost:3000/reset-password');
    const resetLink = `${baseUrl}?token=${generated.rawToken}`;
    await this.mailSender.sendPasswordResetEmail({ to: user.email, resetLink });
  }
}
