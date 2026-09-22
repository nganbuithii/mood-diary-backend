import { ConfigService } from '@nestjs/config';
import { ForgotPasswordUseCase } from './forgot-password.use-case';
import { UserEntity, UserRepository } from '../domain/user.repository';
import { GeneratedResetToken, ResetTokenIssuer } from '../domain/reset-token-issuer';
import {
  CreatePasswordResetTokenInput,
  PasswordResetTokenEntity,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';
import { MailSender, SendPasswordResetEmailInput } from '../domain/mail-sender';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'ngan@example.com',
    passwordHash: 'hashed:whatever',
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
    throw new Error('not used in forgot-password tests');
  }

  create(): Promise<UserEntity> {
    throw new Error('not used in forgot-password tests');
  }

  updatePassword(): Promise<void> {
    throw new Error('not used in forgot-password tests');
  }
}

class FakeResetTokenIssuer implements ResetTokenIssuer {
  public generateCallCount = 0;

  generate(): GeneratedResetToken {
    this.generateCallCount += 1;
    return {
      rawToken: `raw-reset-${this.generateCallCount}`,
      tokenHash: `hash-reset-${this.generateCallCount}`,
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    };
  }

  hash(): string {
    throw new Error('not used in forgot-password tests');
  }
}

class FakePasswordResetTokenRepository implements PasswordResetTokenRepository {
  public createCalls: CreatePasswordResetTokenInput[] = [];
  public invalidateAllForUserCalls: string[] = [];

  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenEntity> {
    this.createCalls.push(input);
    return Promise.resolve({
      id: `reset-${this.createCalls.length}`,
      usedAt: null,
      createdAt: new Date(),
      ...input,
    });
  }

  findByTokenHash(): Promise<PasswordResetTokenEntity | null> {
    throw new Error('not used in forgot-password tests');
  }

  markUsed(): Promise<void> {
    throw new Error('not used in forgot-password tests');
  }

  invalidateAllForUser(userId: string): Promise<void> {
    this.invalidateAllForUserCalls.push(userId);
    return Promise.resolve();
  }
}

class FakeMailSender implements MailSender {
  public sentEmails: SendPasswordResetEmailInput[] = [];

  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
    this.sentEmails.push(input);
    return Promise.resolve();
  }
}

function buildConfig(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
  } as ConfigService;
}

describe('ForgotPasswordUseCase', () => {
  function setup(user: UserEntity | null, configValues: Record<string, unknown> = {}) {
    const userRepository = new FakeUserRepository(user ? new Map([[user.email, user]]) : undefined);
    const resetTokenIssuer = new FakeResetTokenIssuer();
    const resetTokenRepository = new FakePasswordResetTokenRepository();
    const mailSender = new FakeMailSender();
    const config = buildConfig(configValues);
    const useCase = new ForgotPasswordUseCase(userRepository, resetTokenIssuer, resetTokenRepository, mailSender, config);
    return { useCase, userRepository, resetTokenIssuer, resetTokenRepository, mailSender };
  }

  it('does nothing when the email does not exist (same outcome as a known email)', async () => {
    const { useCase, resetTokenRepository, mailSender } = setup(null);

    await expect(useCase.execute({ email: 'unknown@example.com' })).resolves.toBeUndefined();

    expect(resetTokenRepository.createCalls).toHaveLength(0);
    expect(mailSender.sentEmails).toHaveLength(0);
  });

  it('issues a reset token and emails the reset link when the user exists', async () => {
    const user = buildUser();
    const { useCase, resetTokenRepository, mailSender } = setup(user, {
      FRONTEND_RESET_PASSWORD_URL: 'https://app.example.com/reset-password',
    });

    await useCase.execute({ email: user.email });

    expect(resetTokenRepository.createCalls).toEqual([
      {
        userId: user.id,
        tokenHash: 'hash-reset-1',
        expiresAt: new Date('2026-01-01T00:15:00.000Z'),
      },
    ]);
    expect(mailSender.sentEmails).toEqual([
      { to: user.email, resetLink: 'https://app.example.com/reset-password?token=raw-reset-1' },
    ]);
  });

  it('invalidates previously issued tokens before creating a new one', async () => {
    const user = buildUser();
    const { useCase, resetTokenRepository } = setup(user);

    await useCase.execute({ email: user.email });

    expect(resetTokenRepository.invalidateAllForUserCalls).toEqual([user.id]);
  });

  it('normalizes email (trim + lowercase) before lookup', async () => {
    const user = buildUser({ email: 'ngan@example.com' });
    const { useCase, mailSender } = setup(user);

    await useCase.execute({ email: '  Ngan@Example.com  ' });

    expect(mailSender.sentEmails).toEqual([{ to: user.email, resetLink: expect.any(String) }]);
  });
});
