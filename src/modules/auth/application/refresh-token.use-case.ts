import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { TOKEN_ISSUER, TokenIssuer } from '../domain/token-issuer';
import { REFRESH_TOKEN_ISSUER, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { InvalidRefreshTokenError } from '../domain/invalid-refresh-token.error';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
    @Inject(REFRESH_TOKEN_ISSUER) private readonly refreshTokenIssuer: RefreshTokenIssuer,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const presentedHash = this.refreshTokenIssuer.hash(input.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(presentedHash);
    if (!stored) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.revokedAt) {
      // Already rotated away (or previously revoked) and presented again — that's
      // reuse of a dead token, the strongest signal the whole chain is compromised.
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw new InvalidRefreshTokenError();
    }

    const generated = this.refreshTokenIssuer.generate();
    const created = await this.refreshTokenRepository.create({
      userId: stored.userId,
      tokenHash: generated.tokenHash,
      familyId: stored.familyId,
      expiresAt: generated.expiresAt,
    });

    const claimed = await this.refreshTokenRepository.revokeIfActive(stored.id, created.id);
    if (!claimed) {
      // Lost a concurrent rotation race on the same token (e.g. a duplicate
      // request) — another call already rotated it first and wins; this one
      // just cleans up its own unused child and fails.
      await this.refreshTokenRepository.revokeById(created.id);
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    const accessToken = await this.tokenIssuer.issueAccessToken({ sub: user.id, email: user.email });

    return { accessToken, refreshToken: generated.rawToken };
  }
}
