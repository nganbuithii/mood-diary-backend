import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';
import { USER_REPOSITORY, UserEntity, UserRepository } from '../domain/user.repository';
import { TOKEN_ISSUER, TokenIssuer } from '../domain/token-issuer';
import { REFRESH_TOKEN_ISSUER, RefreshTokenIssuer } from '../domain/refresh-token-issuer';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginUserOutput {
  accessToken: string;
  refreshToken: string;
  user: UserEntity;
}

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$A/c1w6xHmjT/91Emzx+OYw$wH0sh5070eyqt1irxShnW7cXfgxWFTTe2zP85vSRWtU';

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
    @Inject(REFRESH_TOKEN_ISSUER) private readonly refreshTokenIssuer: RefreshTokenIssuer,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const email = input.email.trim().toLowerCase();

    const user = await this.userRepository.findByEmail(email);
    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const accessToken = await this.tokenIssuer.issueAccessToken({ sub: user.id, email: user.email });

    const generated = this.refreshTokenIssuer.generate();
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: generated.tokenHash,
      familyId: randomUUID(),
      expiresAt: generated.expiresAt,
    });

    return { accessToken, refreshToken: generated.rawToken, user };
  }
}
