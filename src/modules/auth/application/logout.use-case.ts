import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_ISSUER, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';

export interface LogoutInput {
  refreshToken: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_ISSUER) private readonly refreshTokenIssuer: RefreshTokenIssuer,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = this.refreshTokenIssuer.hash(input.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (!stored) {
      return;
    }

    await this.refreshTokenRepository.revokeFamily(stored.familyId);
  }
}
