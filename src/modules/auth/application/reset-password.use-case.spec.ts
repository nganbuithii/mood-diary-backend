import { ResetPasswordUseCase } from './reset-password.use-case';
import { InvalidResetTokenError } from '../domain/invalid-reset-token.error';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';
import { GeneratedResetToken, ResetTokenIssuer } from '../domain/reset-token-issuer';
import { PasswordResetTokenEntity, PasswordResetTokenRepository } from '../domain/password-reset-token.repository';
import { RefreshTokenEntity, RefreshTokenRepository } from '../domain/refresh-token.repository';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'ngan@example.com',
    passwordHash: 'hashed:old-password',
    displayName: 'Ngân',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildStoredToken(overrides: Partial<PasswordResetTokenEntity> = {}): PasswordResetTokenEntity {
  return {
    id: 'reset-1',
    userId: 'user-1',
    tokenHash: 'hash-of-presented-token',
    usedAt: null,
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeUserRepository implements UserRepository {
  public updatePasswordCalls: Array<{ id: string; passwordHash: string }> = [];

  constructor(private readonly usersById: Map<string, UserEntity>) {}

  findByEmail(): Promise<UserEntity | null> {
    throw new Error('not used in reset-password tests');
  }

  findById(id: string): Promise<UserEntity | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in reset-password tests');
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    this.updatePasswordCalls.push({ id, passwordHash });
    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hashCalls: string[] = [];

  hash(plainPassword: string): Promise<string> {
    this.hashCalls.push(plainPassword);
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(): Promise<boolean> {
    throw new Error('not used in reset-password tests');
  }
}

class FakeResetTokenIssuer implements ResetTokenIssuer {
  hash(rawToken: string): string {
    return `hash-of-${rawToken}`;
  }

  generate(): GeneratedResetToken {
    throw new Error('not used in reset-password tests');
  }
}

class FakePasswordResetTokenRepository implements PasswordResetTokenRepository {
  public markUsedCalls: string[] = [];

  constructor(private readonly tokensByHash: Map<string, PasswordResetTokenEntity>) {}

  create(): Promise<PasswordResetTokenEntity> {
    throw new Error('not used in reset-password tests');
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    return Promise.resolve(this.tokensByHash.get(tokenHash) ?? null);
  }

  markUsed(id: string): Promise<void> {
    this.markUsedCalls.push(id);
    return Promise.resolve();
  }

  invalidateAllForUser(): Promise<void> {
    throw new Error('not used in reset-password tests');
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public revokeAllForUserCalls: string[] = [];

  create(): Promise<RefreshTokenEntity> {
    throw new Error('not used in reset-password tests');
  }

  findByTokenHash(): Promise<RefreshTokenEntity | null> {
    throw new Error('not used in reset-password tests');
  }

  revokeIfActive(): Promise<boolean> {
    throw new Error('not used in reset-password tests');
  }

  revokeById(): Promise<void> {
    throw new Error('not used in reset-password tests');
  }

  revokeFamily(): Promise<void> {
    throw new Error('not used in reset-password tests');
  }

  revokeAllForUser(userId: string): Promise<void> {
    this.revokeAllForUserCalls.push(userId);
    return Promise.resolve();
  }
}

describe('ResetPasswordUseCase', () => {
  function setup(stored: PasswordResetTokenEntity | null, user: UserEntity | null = buildUser()) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.id, user]]) : new Map());
    const passwordHasher = new FakePasswordHasher();
    const resetTokenIssuer = new FakeResetTokenIssuer();
    const resetTokenRepository = new FakePasswordResetTokenRepository(
      stored ? new Map([[stored.tokenHash, stored]]) : new Map(),
    );
    const refreshTokenRepository = new FakeRefreshTokenRepository();
    const useCase = new ResetPasswordUseCase(
      userRepository,
      passwordHasher,
      resetTokenIssuer,
      resetTokenRepository,
      refreshTokenRepository,
    );
    return { useCase, userRepository, passwordHasher, resetTokenRepository, refreshTokenRepository };
  }

  const presentedToken = 'presented-token';

  it('resets the password, marks the token used and revokes every refresh token', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token' });
    const { useCase, userRepository, passwordHasher, resetTokenRepository, refreshTokenRepository } = setup(stored);

    await useCase.execute({ token: presentedToken, newPassword: 'new-password' });

    expect(passwordHasher.hashCalls).toEqual(['new-password']);
    expect(userRepository.updatePasswordCalls).toEqual([{ id: stored.userId, passwordHash: 'hashed:new-password' }]);
    expect(resetTokenRepository.markUsedCalls).toEqual([stored.id]);
    expect(refreshTokenRepository.revokeAllForUserCalls).toEqual([stored.userId]);
  });

  it('rejects a token that does not exist', async () => {
    const { useCase, userRepository } = setup(null);

    await expect(useCase.execute({ token: 'unknown-token', newPassword: 'new-password' })).rejects.toThrow(
      InvalidResetTokenError,
    );
    expect(userRepository.updatePasswordCalls).toHaveLength(0);
  });

  it('rejects an expired token', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token', expiresAt: new Date('2020-01-01') });
    const { useCase, userRepository } = setup(stored);

    await expect(useCase.execute({ token: presentedToken, newPassword: 'new-password' })).rejects.toThrow(
      InvalidResetTokenError,
    );
    expect(userRepository.updatePasswordCalls).toHaveLength(0);
  });

  it('rejects a token that has already been used', async () => {
    const stored = buildStoredToken({
      tokenHash: 'hash-of-presented-token',
      usedAt: new Date('2026-01-01T00:05:00.000Z'),
    });
    const { useCase, userRepository } = setup(stored);

    await expect(useCase.execute({ token: presentedToken, newPassword: 'new-password' })).rejects.toThrow(
      InvalidResetTokenError,
    );
    expect(userRepository.updatePasswordCalls).toHaveLength(0);
  });

  it('rejects when the token owner no longer exists', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token', userId: 'ghost-user' });
    const { useCase, resetTokenRepository } = setup(stored, null);

    await expect(useCase.execute({ token: presentedToken, newPassword: 'new-password' })).rejects.toThrow(
      InvalidResetTokenError,
    );
    expect(resetTokenRepository.markUsedCalls).toHaveLength(0);
  });
});
