export interface GeneratedRefreshToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenIssuer {
  generate(): GeneratedRefreshToken;
  hash(rawToken: string): string;
}

export const REFRESH_TOKEN_ISSUER = Symbol('REFRESH_TOKEN_ISSUER');
