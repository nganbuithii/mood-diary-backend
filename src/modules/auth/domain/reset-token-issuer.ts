export interface GeneratedResetToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ResetTokenIssuer {
  generate(): GeneratedResetToken;
  hash(rawToken: string): string;
}

export const RESET_TOKEN_ISSUER = Symbol('RESET_TOKEN_ISSUER');
