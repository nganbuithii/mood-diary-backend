import { ChangePasswordUseCase } from './change-password.use-case';
import { InvalidCurrentPasswordError } from '../domain/invalid-current-password.error';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';
import { RefreshTokenEntity, RefreshTokenRepository } from '../domain/refresh-token.repository';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed:old-password',
    displayName: 'Ngân',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeUserRepository implements UserRepository {
  public updatePasswordCalls: Array<{ id: string; passwordHash: string }> = [];

  constructor(private readonly usersById: Map<string, UserEntity>) {}

  findByEmail(): Promise<UserEntity | null> {
    throw new Error('not used in change-password tests');
  }

  findById(id: string): Promise<UserEntity | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in change-password tests');
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    this.updatePasswordCalls.push({ id, passwordHash });
    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hashCalls: string[] = [];
  public verifyCalls: Array<{ hash: string; plainPassword: string }> = [];

  constructor(private readonly correctPassword: string) {}

  hash(plainPassword: string): Promise<string> {
    this.hashCalls.push(plainPassword);
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(hash: string, plainPassword: string): Promise<boolean> {
    this.verifyCalls.push({ hash, plainPassword });
    return Promise.resolve(hash === `hashed:${this.correctPassword}` && plainPassword === this.correctPassword);
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public revokeAllForUserCalls: string[] = [];

  create(): Promise<RefreshTokenEntity> {
    throw new Error('not used in change-password tests');
  }

  findByTokenHash(): Promise<RefreshTokenEntity | null> {
    throw new Error('not used in change-password tests');
  }

  revokeIfActive(): Promise<boolean> {
    throw new Error('not used in change-password tests');
  }

  revokeById(): Promise<void> {
    throw new Error('not used in change-password tests');
  }

  revokeFamily(): Promise<void> {
    throw new Error('not used in change-password tests');
  }

  revokeAllForUser(userId: string): Promise<void> {
    this.revokeAllForUserCalls.push(userId);
    return Promise.resolve();
  }
}

describe('ChangePasswordUseCase', () => {
  const correctPassword = 'old-password';

  function setup(user: UserEntity | null) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.id, user]]) : new Map());
    const passwordHasher = new FakePasswordHasher(correctPassword);
    const refreshTokenRepository = new FakeRefreshTokenRepository();
    const useCase = new ChangePasswordUseCase(userRepository, passwordHasher, refreshTokenRepository);
    return { useCase, userRepository, passwordHasher, refreshTokenRepository };
  }

  it('changes the password and revokes every refresh token', async () => {
    const user = buildUser();
    const { useCase, userRepository, passwordHasher, refreshTokenRepository } = setup(user);

    await useCase.execute({ userId: user.id, currentPassword: correctPassword, newPassword: 'new-password' });

    expect(passwordHasher.hashCalls).toEqual(['new-password']);
    expect(userRepository.updatePasswordCalls).toEqual([{ id: user.id, passwordHash: 'hashed:new-password' }]);
    expect(refreshTokenRepository.revokeAllForUserCalls).toEqual([user.id]);
  });

  it('rejects when the current password is wrong', async () => {
    const user = buildUser();
    const { useCase, userRepository, refreshTokenRepository } = setup(user);

    await expect(
      useCase.execute({ userId: user.id, currentPassword: 'wrong-password', newPassword: 'new-password' }),
    ).rejects.toThrow(InvalidCurrentPasswordError);

    expect(userRepository.updatePasswordCalls).toHaveLength(0);
    expect(refreshTokenRepository.revokeAllForUserCalls).toHaveLength(0);
  });

  it('rejects when the user no longer exists', async () => {
    const { useCase, userRepository } = setup(null);

    await expect(
      useCase.execute({ userId: 'ghost-user', currentPassword: correctPassword, newPassword: 'new-password' }),
    ).rejects.toThrow(InvalidCurrentPasswordError);

    expect(userRepository.updatePasswordCalls).toHaveLength(0);
  });
});
