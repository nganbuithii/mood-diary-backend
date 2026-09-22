import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { RESET_TOKEN_ISSUER, ResetTokenIssuer } from '../domain/reset-token-issuer';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { InvalidResetTokenError } from '../domain/invalid-reset-token.error';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(RESET_TOKEN_ISSUER) private readonly resetTokenIssuer: ResetTokenIssuer,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly resetTokenRepository: PasswordResetTokenRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = this.resetTokenIssuer.hash(input.token);
    const stored = await this.resetTokenRepository.findByTokenHash(tokenHash);

    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new InvalidResetTokenError();
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      throw new InvalidResetTokenError();
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.updatePassword(user.id, passwordHash);
    await this.resetTokenRepository.markUsed(stored.id);

    // Password just changed — kill every existing session so a stale/leaked
    // refresh token can no longer be used to stay logged in.
    await this.refreshTokenRepository.revokeAllForUser(user.id);
  }
}
