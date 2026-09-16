import { LoginUserUseCase } from './login-user.use-case';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';
import { AccessTokenPayload, TokenIssuer } from '../domain/token-issuer';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'ngan@example.com',
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

  create(): Promise<UserEntity> {
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

describe('LoginUserUseCase', () => {
  const correctPassword = 'correct-password';

  function setup(user: UserEntity | null) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.email, user]]) : undefined);
    const passwordHasher = new FakePasswordHasher(correctPassword);
    const tokenIssuer = new FakeTokenIssuer();
    const useCase = new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer);
    return { useCase, userRepository, passwordHasher, tokenIssuer };
  }

  it('logs in with correct email and password', async () => {
    const user = buildUser();
    const { useCase, tokenIssuer } = setup(user);

    const result = await useCase.execute({ email: user.email, password: correctPassword });

    expect(result.accessToken).toBe(`token-for-${user.id}`);
    expect(result.user).toEqual(user);
    expect(tokenIssuer.issuedPayloads).toEqual([{ sub: user.id, email: user.email }]);
  });

  it('normalizes email (trim + lowercase) before lookup', async () => {
    const user = buildUser({ email: 'ngan@example.com' });
    const { useCase } = setup(user);

    const result = await useCase.execute({ email: '  Ngan@Example.com  ', password: correctPassword });

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

  it('does not issue a token when credentials are invalid', async () => {
    const user = buildUser();
    const { useCase, tokenIssuer } = setup(user);

    await expect(useCase.execute({ email: user.email, password: 'wrong-password' })).rejects.toThrow(
      InvalidCredentialsError,
    );

    expect(tokenIssuer.issuedPayloads).toHaveLength(0);
  });
});
