export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  /**
   * Revokes the token only if it isn't already revoked (atomic compare-and-swap
   * at the DB level). Returns false when another request already revoked it
   * first — the caller lost the race and must not treat its own rotation as valid.
   */
  revokeIfActive(id: string, replacedByTokenId: string): Promise<boolean>;
  revokeById(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
