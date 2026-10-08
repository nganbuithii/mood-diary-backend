import { DeleteAccountUseCase } from './delete-account.use-case';
import { PasswordHasher } from '../../auth/domain/password-hasher';
import { UserEntity, UserRepository } from '../../auth/domain/user.repository';
import { AccountExportData, AccountRepository } from '../domain/account.repository';
import { IncorrectPasswordError } from '../domain/incorrect-password.error';
import { UserMediaStorage } from '../domain/user-media-storage';
import { UserNotFoundError } from '../domain/user-not-found.error';

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
  constructor(private readonly usersById: Map<string, UserEntity>) {}

  findByEmail(): Promise<UserEntity | null> {
    throw new Error('not used in delete-account tests');
  }

  findById(id: string): Promise<UserEntity | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in delete-account tests');
  }

  updatePassword(): Promise<void> {
    throw new Error('not used in delete-account tests');
  }
}

class FakePasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(hash: string, plainPassword: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plainPassword}`);
  }
}

class FakeUserMediaStorage implements UserMediaStorage {
  public deletedForUsers: string[] = [];
  public shouldFail = false;

  deleteAllForUser(userId: string): Promise<void> {
    if (this.shouldFail) return Promise.reject(new Error('storage unavailable'));
    this.deletedForUsers.push(userId);
    return Promise.resolve();
  }
}

class FakeAccountRepository implements AccountRepository {
  public deletedUserIds: string[] = [];

  findExportData(): Promise<AccountExportData | null> {
    throw new Error('not used in delete-account tests');
  }

  delete(userId: string): Promise<void> {
    this.deletedUserIds.push(userId);
    return Promise.resolve();
  }
}

describe('DeleteAccountUseCase', () => {
  function setup(user: UserEntity | null = buildUser()) {
    const userMediaStorage = new FakeUserMediaStorage();
    const accountRepository = new FakeAccountRepository();
    const useCase = new DeleteAccountUseCase(
      new FakeUserRepository(user ? new Map([[user.id, user]]) : new Map()),
      new FakePasswordHasher(),
      userMediaStorage,
      accountRepository,
    );
    return { useCase, userMediaStorage, accountRepository };
  }

  it('deletes the media and then the account when the password is correct', async () => {
    const { useCase, userMediaStorage, accountRepository } = setup();

    await useCase.execute({ userId: 'user-1', password: 'correct-password' });

    expect(userMediaStorage.deletedForUsers).toEqual(['user-1']);
    expect(accountRepository.deletedUserIds).toEqual(['user-1']);
  });

  it('rejects a wrong password and deletes nothing', async () => {
    const { useCase, userMediaStorage, accountRepository } = setup();

    await expect(useCase.execute({ userId: 'user-1', password: 'wrong-password' })).rejects.toBeInstanceOf(
      IncorrectPasswordError,
    );

    expect(userMediaStorage.deletedForUsers).toEqual([]);
    expect(accountRepository.deletedUserIds).toEqual([]);
  });

  it('keeps the account when the media cannot be deleted, so the user can retry', async () => {
    const { useCase, userMediaStorage, accountRepository } = setup();
    userMediaStorage.shouldFail = true;

    await expect(useCase.execute({ userId: 'user-1', password: 'correct-password' })).rejects.toThrow(
      'storage unavailable',
    );

    expect(accountRepository.deletedUserIds).toEqual([]);
  });

  it('throws UserNotFoundError when the user no longer exists', async () => {
    const { useCase, accountRepository } = setup(null);

    await expect(useCase.execute({ userId: 'user-1', password: 'correct-password' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );

    expect(accountRepository.deletedUserIds).toEqual([]);
  });
});
