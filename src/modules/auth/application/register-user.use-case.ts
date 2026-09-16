import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';
import { USER_REPOSITORY, UserEntity, UserRepository } from '../domain/user.repository';
import { EmailAlreadyExistsError } from '../domain/email-already-exists.error';

export interface RegisterUserInput {
  displayName: string;
  email: string;
  password: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<UserEntity> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new EmailAlreadyExistsError(email);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.userRepository.create({ email, displayName, passwordHash });
  }
}
