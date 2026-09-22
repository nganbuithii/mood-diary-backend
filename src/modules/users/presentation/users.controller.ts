import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { UsersService } from '../application/users.service';
import { InvalidAvatarImageError } from '../domain/invalid-avatar-image.error';
import { UserNotFoundError } from '../domain/user-not-found.error';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
