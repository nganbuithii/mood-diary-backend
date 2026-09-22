import { LoginUserUseCase } from './login-user.use-case';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';
import { AccessTokenPayload, TokenIssuer } from '../domain/token-issuer';
import { GeneratedRefreshToken, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { CreateRefreshTokenInput, RefreshTokenEntity, RefreshTokenRepository } from '../domain/refresh-token.repository';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed:correct-password',
    displayName: 'Ngân',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeUserRepository implements UserRepository {
  constructor(private readonly usersByEmail: Map<string, UserEntity> = new Map()) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return Promise.resolve(this.usersByEmail.get(email) ?? null);
  }

  findById(): Promise<UserEntity | null> {
    throw new Error('not used in login tests');
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in login tests');
  }

  updatePassword(): Promise<void> {
    throw new Error('not used in login tests');
  }
}

class FakePasswordHasher implements PasswordHasher {
  public verifyCalls: Array<{ hash: string; plainPassword: string }> = [];

  constructor(private readonly correctPassword: string) {}

  hash(): Promise<string> {
    throw new Error('not used in login tests');
  }

  verify(hash: string, plainPassword: string): Promise<boolean> {
    this.verifyCalls.push({ hash, plainPassword });
    return Promise.resolve(hash === `hashed:${this.correctPassword}` && plainPassword === this.correctPassword);
  }
}

class FakeTokenIssuer implements TokenIssuer {
  public issuedPayloads: AccessTokenPayload[] = [];

  issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    this.issuedPayloads.push(payload);
    return Promise.resolve(`token-for-${payload.sub}`);
  }
}

class FakeRefreshTokenIssuer implements RefreshTokenIssuer {
  public generateCallCount = 0;

  generate(): GeneratedRefreshToken {
    this.generateCallCount += 1;
    return {
      rawToken: `raw-refresh-${this.generateCallCount}`,
      tokenHash: `hash-refresh-${this.generateCallCount}`,
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    };
  }

  hash(): string {
    throw new Error('not used in login tests');
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public createCalls: CreateRefreshTokenInput[] = [];

  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    this.createCalls.push(input);
    return Promise.resolve({
      id: `refresh-${this.createCalls.length}`,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      ...input,
    });
  }

  findByTokenHash(): Promise<RefreshTokenEntity | null> {
    throw new Error('not used in login tests');
  }

  revokeIfActive(): Promise<boolean> {
    throw new Error('not used in login tests');
  }

  revokeById(): Promise<void> {
    throw new Error('not used in login tests');
  }

  revokeFamily(): Promise<void> {
    throw new Error('not used in login tests');
  }

  revokeAllForUser(): Promise<void> {
    throw new Error('not used in login tests');
  }
}

describe('LoginUserUseCase', () => {
  const correctPassword = 'correct-password';

  function setup(user: UserEntity | null) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.email, user]]) : undefined);
    const passwordHasher = new FakePasswordHasher(correctPassword);
    const tokenIssuer = new FakeTokenIssuer();
    const refreshTokenIssuer = new FakeRefreshTokenIssuer();
    const refreshTokenRepository = new FakeRefreshTokenRepository();
    const useCase = new LoginUserUseCase(
      userRepository,
      passwordHasher,
      tokenIssuer,
      refreshTokenIssuer,
      refreshTokenRepository,
    );
    return { useCase, userRepository, passwordHasher, tokenIssuer, refreshTokenIssuer, refreshTokenRepository };
  }

  it('logs in with correct email and password', async () => {
    const user = buildUser();
    const { useCase, tokenIssuer, refreshTokenRepository } = setup(user);

    const result = await useCase.execute({ email: user.email, password: correctPassword });

    expect(result.accessToken).toBe(`token-for-${user.id}`);
    expect(result.refreshToken).toBe('raw-refresh-1');
    expect(result.user).toEqual(user);
    expect(tokenIssuer.issuedPayloads).toEqual([{ sub: user.id, email: user.email }]);
    expect(refreshTokenRepository.createCalls).toEqual([
      {
        userId: user.id,
        tokenHash: 'hash-refresh-1',
        familyId: expect.any(String),
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);
  });

  it('creates a fresh token family on every login', async () => {
    const user = buildUser();
    const { useCase, refreshTokenRepository } = setup(user);

    await useCase.execute({ email: user.email, password: correctPassword });
    await useCase.execute({ email: user.email, password: correctPassword });

    const [firstFamilyId, secondFamilyId] = refreshTokenRepository.createCalls.map((call) => call.familyId);
    expect(firstFamilyId).not.toBe(secondFamilyId);
  });

  it('normalizes email (trim + lowercase) before lookup', async () => {
    const user = buildUser({ email: 'test@example.com' });
    const { useCase } = setup(user);

    const result = await useCase.execute({ email: '  test@example.com  ', password: correctPassword });

    expect(result.user).toEqual(user);
  });

  it('rejects wrong password with InvalidCredentialsError', async () => {
    const user = buildUser();
    const { useCase } = setup(user);

    await expect(useCase.execute({ email: user.email, password: 'wrong-password' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects unknown email with InvalidCredentialsError', async () => {
    const { useCase } = setup(null);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: correctPassword }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('still runs password verification when the user does not exist (timing-safety)', async () => {
    const { useCase, passwordHasher } = setup(null);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: correctPassword }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(passwordHasher.verifyCalls).toHaveLength(1);
    expect(passwordHasher.verifyCalls[0].hash).toEqual(expect.any(String));
    expect(passwordHasher.verifyCalls[0].hash.length).toBeGreaterThan(0);
  });

  it('does not issue any token when credentials are invalid', async () => {
    const user = buildUser();
    const { useCase, tokenIssuer, refreshTokenRepository } = setup(user);

    await expect(useCase.execute({ email: user.email, password: 'wrong-password' })).rejects.toThrow(
      InvalidCredentialsError,
    );

    expect(tokenIssuer.issuedPayloads).toHaveLength(0);
    expect(refreshTokenRepository.createCalls).toHaveLength(0);
  });
});
