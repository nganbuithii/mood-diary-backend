import { RegisterUserUseCase } from './register-user.use-case';
import { EmailAlreadyExistsError } from '../domain/email-already-exists.error';
import { CreateUserInput, UserEntity, UserRepository } from '../domain/user.repository';
import { PasswordHasher } from '../domain/password-hasher';

class FakeUserRepository implements UserRepository {
  public createCalls: CreateUserInput[] = [];

  constructor(private readonly existingUsersByEmail: Map<string, UserEntity> = new Map()) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return Promise.resolve(this.existingUsersByEmail.get(email) ?? null);
  }

  findById(): Promise<UserEntity | null> {
    throw new Error('not used in register tests');
  }

  create(input: CreateUserInput): Promise<UserEntity> {
    this.createCalls.push(input);
    return Promise.resolve({
      id: 'new-user-id',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...input,
    });
  }

  updatePassword(): Promise<void> {
    throw new Error('not used in register tests');
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hashCalls: string[] = [];

  hash(plainPassword: string): Promise<string> {
    this.hashCalls.push(plainPassword);
    return Promise.resolve(`hashed:${plainPassword}`);
  }

  verify(): Promise<boolean> {
    throw new Error('not used in register tests');
  }
}

describe('RegisterUserUseCase', () => {
  function setup(existingUser: UserEntity | null = null) {
    const userRepository = new FakeUserRepository(
      existingUser ? new Map([[existingUser.email, existingUser]]) : undefined,
    );
    const passwordHasher = new FakePasswordHasher();
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher);
    return { useCase, userRepository, passwordHasher };
  }

  it('registers a new user with a hashed password', async () => {
    const { useCase, userRepository, passwordHasher } = setup();

    const user = await useCase.execute({
      displayName: 'Ngân',
      email: 'test@example.com',
      password: 'plain-password',
    });

    expect(passwordHasher.hashCalls).toEqual(['plain-password']);
    expect(userRepository.createCalls).toEqual([
      { email: 'test@example.com', displayName: 'Ngân', passwordHash: 'hashed:plain-password' },
    ]);
    expect(user.passwordHash).toBe('hashed:plain-password');
  });

  it('normalizes email (trim + lowercase) and displayName (trim) before creating', async () => {
    const { useCase, userRepository } = setup();

    await useCase.execute({
      displayName: '  Ngân  ',
      email: '  test@example.com  ',
      password: 'plain-password',
    });

    expect(userRepository.createCalls[0]).toMatchObject({
      email: 'test@example.com',
      displayName: 'Ngân',
    });
  });

  it('rejects registration when the email already exists', async () => {
    const existingUser: UserEntity = {
      id: 'existing-id',
      email: 'test@example.com',
      passwordHash: 'hashed:something',
      displayName: 'Ngân',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { useCase, userRepository, passwordHasher } = setup(existingUser);

    await expect(
      useCase.execute({ displayName: 'Ngân', email: 'test@example.com', password: 'plain-password' }),
    ).rejects.toThrow(EmailAlreadyExistsError);

    expect(passwordHasher.hashCalls).toHaveLength(0);
    expect(userRepository.createCalls).toHaveLength(0);
  });
});
