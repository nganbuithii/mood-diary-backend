import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { LoginUserUseCase } from './application/login-user.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { RefreshTokenUseCase } from './application/refresh-token.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { MAIL_SENDER } from './domain/mail-sender';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/password-reset-token.repository';
import { REFRESH_TOKEN_ISSUER } from './domain/refresh-token-issuer';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { RESET_TOKEN_ISSUER } from './domain/reset-token-issuer';
import { TOKEN_ISSUER } from './domain/token-issuer';
import { USER_REPOSITORY } from './domain/user.repository';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { CryptoRefreshTokenIssuer } from './infrastructure/crypto-refresh-token-issuer';
import { CryptoResetTokenIssuer } from './infrastructure/crypto-reset-token-issuer';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { NodemailerMailSender } from './infrastructure/nodemailer-mail-sender';
import { PrismaPasswordResetTokenRepository } from './infrastructure/prisma-password-reset-token.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<number>('JWT_ACCESS_EXPIRES_IN_SECONDS') },
      }),
    }),
    // Registered here (not AppModule) since only forgot/reset-password need
    // throttling today — ThrottlerModule is @Global() so this is enough for
    // ThrottlerGuard to resolve everywhere it's applied.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    JwtAuthGuard,
    ThrottlerGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: REFRESH_TOKEN_ISSUER, useClass: CryptoRefreshTokenIssuer },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: RESET_TOKEN_ISSUER, useClass: CryptoResetTokenIssuer },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
