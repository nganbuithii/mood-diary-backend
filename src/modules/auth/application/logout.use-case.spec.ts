import { LogoutUseCase } from './logout.use-case';
import { GeneratedRefreshToken, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { RefreshTokenEntity, RefreshTokenRepository } from '../domain/refresh-token.repository';

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

class FakeRefreshTokenIssuer implements RefreshTokenIssuer {
  hash(rawToken: string): string {
    return `hash-of-${rawToken}`;
  }

  generate(): GeneratedRefreshToken {
    throw new Error('not used in logout tests');
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public revokeFamilyCalls: string[] = [];

  constructor(private readonly tokensByHash: Map<string, RefreshTokenEntity>) {}

  create(): Promise<RefreshTokenEntity> {
    throw new Error('not used in logout tests');
  }

  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return Promise.resolve(this.tokensByHash.get(tokenHash) ?? null);
  }

  revokeIfActive(): Promise<boolean> {
    throw new Error('not used in logout tests');
  }

  revokeById(): Promise<void> {
    throw new Error('not used in logout tests');
  }

  revokeFamily(familyId: string): Promise<void> {
    this.revokeFamilyCalls.push(familyId);
    return Promise.resolve();
  }

  revokeAllForUser(): Promise<void> {
    throw new Error('not used in logout tests');
  }
}

describe('LogoutUseCase', () => {
  const presentedToken = 'presented-token';

  it('revokes the whole family for a known refresh token', async () => {
    const stored = buildStoredToken({ tokenHash: 'hash-of-presented-token', familyId: 'family-7' });
    const refreshTokenRepository = new FakeRefreshTokenRepository(new Map([[stored.tokenHash, stored]]));
    const useCase = new LogoutUseCase(new FakeRefreshTokenIssuer(), refreshTokenRepository);

    await useCase.execute({ refreshToken: presentedToken });

    expect(refreshTokenRepository.revokeFamilyCalls).toEqual(['family-7']);
  });

  it('is a no-op (idempotent) when the refresh token is unknown', async () => {
    const refreshTokenRepository = new FakeRefreshTokenRepository(new Map());
    const useCase = new LogoutUseCase(new FakeRefreshTokenIssuer(), refreshTokenRepository);

    await expect(useCase.execute({ refreshToken: 'unknown-token' })).resolves.toBeUndefined();
    expect(refreshTokenRepository.revokeFamilyCalls).toHaveLength(0);
  });
});
