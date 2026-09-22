import { RefreshTokenUseCase } from './refresh-token.use-case';
import { InvalidRefreshTokenError } from '../domain/invalid-refresh-token.error';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { AccessTokenPayload, TokenIssuer } from '../domain/token-issuer';
import { GeneratedRefreshToken, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { CreateRefreshTokenInput, RefreshTokenEntity, RefreshTokenRepository } from '../domain/refresh-token.repository';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed:whatever',
    displayName: 'Ngân',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildStoredToken(overrides: Partial<RefreshTokenEntity> = {}): RefreshTokenEntity {
  return {
    id: 'refresh-1',
    userId: 'user-1',
    tokenHash: 'hash-of-presented-token',
    familyId: 'family-1',
    revokedAt: null,
    replacedByTokenId: null,
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeUserRepository implements UserRepository {
  constructor(private readonly usersById: Map<string, UserEntity>) {}

  findByEmail(): Promise<UserEntity | null> {
    throw new Error('not used in refresh tests');
  }

  findById(id: string): Promise<UserEntity | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in refresh tests');
  }

  updatePassword(): Promise<void> {
    throw new Error('not used in refresh tests');
  }
}

class FakeTokenIssuer implements TokenIssuer {
  public issuedPayloads: AccessTokenPayload[] = [];

  issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    this.issuedPayloads.push(payload);
    return Promise.resolve(`access-for-${payload.sub}`);
  }
}

class FakeRefreshTokenIssuer implements RefreshTokenIssuer {
  hash(rawToken: string): string {
    return `hash-of-${rawToken}`;
  }

  generate(): GeneratedRefreshToken {
    return {
      rawToken: 'new-raw-token',
      tokenHash: 'new-token-hash',
      expiresAt: new Date('2099-06-01T00:00:00.000Z'),
    };
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public createCalls: CreateRefreshTokenInput[] = [];
  public revokeFamilyCalls: string[] = [];
  public revokeByIdCalls: string[] = [];
  public revokeIfActiveResult = true;
  public revokeIfActiveCalls: Array<{ id: string; replacedByTokenId: string }> = [];

  constructor(private readonly tokensByHash: Map<string, RefreshTokenEntity>) {}

  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    this.createCalls.push(input);
    const created: RefreshTokenEntity = {
      id: `created-${this.createCalls.length}`,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      ...input,
    };
    return Promise.resolve(created);
  }

  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return Promise.resolve(this.tokensByHash.get(tokenHash) ?? null);
  }

  revokeIfActive(id: string, replacedByTokenId: string): Promise<boolean> {
    this.revokeIfActiveCalls.push({ id, replacedByTokenId });
    return Promise.resolve(this.revokeIfActiveResult);
  }

  revokeById(id: string): Promise<void> {
    this.revokeByIdCalls.push(id);
    return Promise.resolve();
  }

  revokeFamily(familyId: string): Promise<void> {
    this.revokeFamilyCalls.push(familyId);
    return Promise.resolve();
  }

  revokeAllForUser(): Promise<void> {
    throw new Error('not used in refresh tests');
  }
}

describe('RefreshTokenUseCase', () => {
  function setup(stored: RefreshTokenEntity | null, user: UserEntity | null = buildUser()) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.id, user]]) : new Map());
    const tokenIssuer = new FakeTokenIssuer();
    const refreshTokenIssuer = new FakeRefreshTokenIssuer();
    const refreshTokenRepository = new FakeRefreshTokenRepository(
      stored ? new Map([[stored.tokenHash, stored]]) : new Map(),
    );
    const useCase = new RefreshTokenUseCase(userRepository, tokenIssuer, refreshTokenIssuer, refreshTokenRepository);
    return { useCase, userRepository, tokenIssuer, refreshTokenIssuer, refreshTokenRepository };
  }

  const presentedToken = 'presented-token';

  it('rotates a valid refresh token and issues a new access token', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token' });
    const { useCase, tokenIssuer, refreshTokenRepository } = setup(stored);

    const result = await useCase.execute({ refreshToken: presentedToken });

    expect(result.accessToken).toBe('access-for-user-1');
    expect(result.refreshToken).toBe('new-raw-token');
    expect(tokenIssuer.issuedPayloads).toEqual([{ sub: 'user-1', email: 'test@example.com' }]);

    expect(refreshTokenRepository.createCalls).toEqual([
      {
        userId: stored.userId,
        tokenHash: 'new-token-hash',
        familyId: stored.familyId,
        expiresAt: new Date('2099-06-01T00:00:00.000Z'),
      },
    ]);
    expect(refreshTokenRepository.revokeIfActiveCalls).toEqual([{ id: stored.id, replacedByTokenId: 'created-1' }]);
    expect(refreshTokenRepository.revokeFamilyCalls).toHaveLength(0);
  });

  it('rejects a refresh token that does not exist', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute({ refreshToken: 'unknown-token' })).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an expired refresh token', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token', expiresAt: new Date('2020-01-01') });
    const { useCase, refreshTokenRepository } = setup(stored);

    await expect(useCase.execute({ refreshToken: presentedToken })).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokenRepository.createCalls).toHaveLength(0);
  });

  it('kills the whole token family when an already-revoked token is reused', async () => {
    const stored = buildStoredToken({
      tokenHash: 'hash-of-presented-token',
      revokedAt: new Date('2026-01-02T00:00:00.000Z'),
      familyId: 'family-42',
    });
    const { useCase, refreshTokenRepository } = setup(stored);

    await expect(useCase.execute({ refreshToken: presentedToken })).rejects.toThrow(InvalidRefreshTokenError);

    expect(refreshTokenRepository.revokeFamilyCalls).toEqual(['family-42']);
    expect(refreshTokenRepository.createCalls).toHaveLength(0);
  });

  it('cleans up its own token (without killing the family) when it loses a rotation race', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token' });
    const { useCase, refreshTokenRepository } = setup(stored);
    refreshTokenRepository.revokeIfActiveResult = false;

    await expect(useCase.execute({ refreshToken: presentedToken })).rejects.toThrow(InvalidRefreshTokenError);

    expect(refreshTokenRepository.revokeByIdCalls).toEqual(['created-1']);
    expect(refreshTokenRepository.revokeFamilyCalls).toHaveLength(0);
  });

  it('rejects when the token owner no longer exists', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token', userId: 'ghost-user' });
    const { useCase } = setup(stored, null);

    await expect(useCase.execute({ refreshToken: presentedToken })).rejects.toThrow(InvalidRefreshTokenError);
  });
});
