export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface TokenIssuer {
  issueAccessToken(payload: AccessTokenPayload): Promise<string>;
}

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');
