import { Module } from '@nestjs/common';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { USER_REPOSITORY } from './domain/user.repository';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoginUserUseCase } from './application/login-user.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { TOKEN_ISSUER } from './domain/token-issuer';
import { USER_REPOSITORY } from './domain/user.repository';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
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
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
