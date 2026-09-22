import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { InvalidCurrentPasswordError } from '../domain/invalid-current-password.error';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new InvalidCurrentPasswordError();
    }

    const currentPasswordMatches = await this.passwordHasher.verify(user.passwordHash, input.currentPassword);
    if (!currentPasswordMatches) {
      throw new InvalidCurrentPasswordError();
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.updatePassword(user.id, passwordHash);

    await this.refreshTokenRepository.revokeAllForUser(user.id);
  }
}
