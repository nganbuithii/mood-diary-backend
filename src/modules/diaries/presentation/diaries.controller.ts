import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
import { DiariesService } from '../application/diaries.service';
import { MAX_ENTRY_PHOTOS } from '../domain/diary-entry.repository';
import { InvalidDiaryPhotoError } from '../domain/invalid-diary-photo.error';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { DiaryEntryResponseDto } from './dto/diary-entry-response.dto';
import { ListDiaryEntriesQueryDto } from './dto/list-diary-entries-query.dto';
import { UpsertDiaryEntryDto } from './dto/upsert-diary-entry.dto';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('diaries')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('diaries')
export class DiariesController {
  constructor(private readonly diariesService: DiariesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_ENTRY_PHOTOS, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Photos must be image files'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-09-25' },
        mood: { type: 'string', example: 'HAPPY' },
        note: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: MAX_ENTRY_PHOTOS },
      },
    },
  })
  @ApiOkResponse({ description: 'Entry created or updated for that date', type: DiaryEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date, mood, note or photo' })
  @ApiPayloadTooLargeResponse({ description: 'A photo exceeds 5MB' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async upsert(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: UpsertDiaryEntryDto,
    @UploadedFiles() photos: Express.Multer.File[] = [],
  ): Promise<DiaryEntryResponseDto> {
    try {
      const entry = await this.diariesService.upsertEntry({
        userId: payload.sub,
        date: dto.date,
        mood: dto.mood,
        note: dto.note,
        photos: photos.map((file) => file.buffer),
      });
      return DiaryEntryResponseDto.fromEntity(entry);
    } catch (error) {
      if (error instanceof InvalidEntryDateError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidDiaryPhotoError) {
        throw new BadRequestException('One of the photos is not a valid image file');
      }
      throw error;
    }
  }

  @Get()
  @ApiOkResponse({ description: 'Entries within the given month', type: [DiaryEntryResponseDto] })
  @ApiBadRequestResponse({ description: 'Invalid month' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async listByMonth(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: ListDiaryEntriesQueryDto,
  ): Promise<DiaryEntryResponseDto[]> {
    const entries = await this.diariesService.listEntriesForMonth(payload.sub, query.month);
    return entries.map((entry) => DiaryEntryResponseDto.fromEntity(entry));
  }
}
