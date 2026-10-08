import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, PasswordHasher } from '../../auth/domain/password-hasher';
import { USER_REPOSITORY, UserRepository } from '../../auth/domain/user.repository';
import { ACCOUNT_REPOSITORY, AccountRepository } from '../domain/account.repository';
import { IncorrectPasswordError } from '../domain/incorrect-password.error';
import { USER_MEDIA_STORAGE, UserMediaStorage } from '../domain/user-media-storage';
import { UserNotFoundError } from '../domain/user-not-found.error';

export interface DeleteAccountInput {
  userId: string;
  password: string;
}

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(USER_MEDIA_STORAGE) private readonly userMediaStorage: UserMediaStorage,
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: DeleteAccountInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    if (!(await this.passwordHasher.verify(user.passwordHash, input.password))) {
      throw new IncorrectPasswordError();
    }

    // Media first: if storage fails the account is still intact and the user can retry,
    // instead of leaving photos reachable by URL with no record left to clean them up.
    await this.userMediaStorage.deleteAllForUser(user.id);
    await this.accountRepository.delete(user.id);
  }
}
