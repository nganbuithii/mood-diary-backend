import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { LoginUserUseCase } from '../application/login-user.use-case';
import { EmailAlreadyExistsError } from '../domain/email-already-exists.error';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';
import { AccessTokenPayload } from '../domain/token-issuer';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { JwtAuthGuard } from '../infrastructure/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    try {
      const { accessToken, user } = await this.loginUserUseCase.execute(dto);
      return LoginResponseDto.from(accessToken, user);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current authenticated user', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<UserResponseDto> {
    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return UserResponseDto.fromEntity(user);
  }
}
