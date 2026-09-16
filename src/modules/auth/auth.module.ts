import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoginUserUseCase } from './application/login-user.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { RefreshTokenUseCase } from './application/refresh-token.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { REFRESH_TOKEN_ISSUER } from './domain/refresh-token-issuer';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { TOKEN_ISSUER } from './domain/token-issuer';
import { USER_REPOSITORY } from './domain/user.repository';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { CryptoRefreshTokenIssuer } from './infrastructure/crypto-refresh-token-issuer';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
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
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: REFRESH_TOKEN_ISSUER, useClass: CryptoRefreshTokenIssuer },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
