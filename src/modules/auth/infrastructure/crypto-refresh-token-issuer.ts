import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedRefreshToken, RefreshTokenIssuer } from '../domain/refresh-token-issuer';

const RAW_TOKEN_BYTES = 64;

@Injectable()
export class CryptoRefreshTokenIssuer implements RefreshTokenIssuer {
  constructor(private readonly config: ConfigService) {}

  generate(): GeneratedRefreshToken {
    const rawToken = randomBytes(RAW_TOKEN_BYTES).toString('base64url');
    const ttlSeconds = this.config.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 30);

    return {
      rawToken,
      tokenHash: this.hash(rawToken),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
