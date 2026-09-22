import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { LoginUserUseCase } from '../application/login-user.use-case';
import { RefreshTokenUseCase } from '../application/refresh-token.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { ForgotPasswordUseCase } from '../application/forgot-password.use-case';
import { ResetPasswordUseCase } from '../application/reset-password.use-case';
import { EmailAlreadyExistsError } from '../domain/email-already-exists.error';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../domain/invalid-refresh-token.error';
import { InvalidResetTokenError } from '../domain/invalid-reset-token.error';
import { AccessTokenPayload } from '../domain/token-issuer';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from '../infrastructure/auth-cookies';
import { JwtAuthGuard } from '../infrastructure/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'User registered', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiConflictResponse({ description: 'Email already exists' })
  async register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    try {
      const user = await this.registerUserUseCase.execute(dto);
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  // Tokens are never returned in the body — they're set as httpOnly cookies
  // so client-side JS (and anything it's tricked into running via XSS) can
  // never read them. The FE only needs `credentials: 'include'` on requests.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Login successful — tokens set as httpOnly cookies', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<UserResponseDto> {
    try {
      const { accessToken, refreshToken, user } = await this.loginUserUseCase.execute(dto);
      this.setAuthCookies(res, accessToken, refreshToken);
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'New access + refresh token pair set as httpOnly cookies' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired or reused refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const presentedToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!presentedToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const { accessToken, refreshToken } = await this.refreshTokenUseCase.execute({
        refreshToken: presentedToken,
      });
      this.setAuthCookies(res, accessToken, refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        this.clearAuthCookies(res);
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked (idempotent even if the token was already invalid)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const presentedToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (presentedToken) {
      await this.logoutUseCase.execute({ refreshToken: presentedToken });
    }
    this.clearAuthCookies(res);
  }

  // Always the same response whether or not the email exists — a different
  // status/body per case would let a caller enumerate registered accounts.
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'If the email exists, a reset link was sent' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.forgotPasswordUseCase.execute(dto);
    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiNoContentResponse({ description: 'Password reset — all existing sessions are revoked' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired or already-used reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    try {
      await this.resetPasswordUseCase.execute(dto);
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  @ApiOkResponse({ description: 'Current authenticated user', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<UserResponseDto> {
    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return UserResponseDto.fromEntity(user);
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('COOKIE_SECURE', false),
      sameSite: 'lax',
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const accessTtlSeconds = this.configService.get<number>('JWT_ACCESS_EXPIRES_IN_SECONDS', 900);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.baseCookieOptions(),
      path: '/',
      maxAge: accessTtlSeconds * 1000,
    });

    const refreshTtlSeconds = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 30);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.baseCookieOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: refreshTtlSeconds * 1000,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...this.baseCookieOptions(), path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { ...this.baseCookieOptions(), path: REFRESH_TOKEN_COOKIE_PATH });
  }
}
