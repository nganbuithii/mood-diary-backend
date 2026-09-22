import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedResetToken, ResetTokenIssuer } from '../domain/reset-token-issuer';

const RAW_TOKEN_BYTES = 32;

@Injectable()
export class CryptoResetTokenIssuer implements ResetTokenIssuer {
  constructor(private readonly config: ConfigService) {}

  generate(): GeneratedResetToken {
    const rawToken = randomBytes(RAW_TOKEN_BYTES).toString('base64url');
    const ttlSeconds = this.config.get<number>('PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS', 900);

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
