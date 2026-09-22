export interface PasswordResetTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface PasswordResetTokenRepository {
  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');
