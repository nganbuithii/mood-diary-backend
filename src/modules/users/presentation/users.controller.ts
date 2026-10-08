import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE, clearAuthCookies } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { DeleteAccountUseCase } from '../application/delete-account.use-case';
import { ExportAccountUseCase } from '../application/export-account.use-case';
import { UsersService } from '../application/users.service';
import { IncorrectPasswordError } from '../domain/incorrect-password.error';
import { InvalidAvatarImageError } from '../domain/invalid-avatar-image.error';
import { UserNotFoundError } from '../domain/user-not-found.error';
import { AccountExportDto } from './dto/account-export.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly exportAccountUseCase: ExportAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  @ApiOkResponse({ description: 'Everything stored for the current user, as JSON', type: AccountExportDto })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async exportAccount(@CurrentUser() payload: AccessTokenPayload): Promise<AccountExportDto> {
    try {
      return AccountExportDto.fromExport(await this.exportAccountUseCase.execute(payload.sub));
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      throw error;
    }
  }

  // 403 rather than 401 for a wrong password: a 401 makes the web client refresh
  // its session and resend the password, which would hide the real error.
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  @ApiNoContentResponse({ description: 'Account, entries, letters and photos deleted; auth cookies cleared' })
  @ApiForbiddenResponse({ description: 'Password is incorrect' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async deleteAccount(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      await this.deleteAccountUseCase.execute({ userId: payload.sub, password: dto.password });
      clearAuthCookies(res, this.configService.get<boolean>('COOKIE_SECURE', false));
    } catch (error) {
      if (error instanceof IncorrectPasswordError) {
        throw new ForbiddenException('Password is incorrect');
      }
      if (error instanceof UserNotFoundError) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      throw error;
    }
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Avatar must be an image file'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ description: 'Avatar uploaded', type: UserProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Missing file, or file is not a valid image' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds 5MB' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async uploadAvatar(
    @CurrentUser() payload: AccessTokenPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserProfileResponseDto> {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    try {
      const user = await this.usersService.uploadAvatar(payload.sub, file.buffer);
      return UserProfileResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      if (error instanceof InvalidAvatarImageError) {
        throw new BadRequestException('Avatar must be a valid image file');
      }
      throw error;
    }
  }
}
