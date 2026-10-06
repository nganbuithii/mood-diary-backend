import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { DeleteDiaryEntryUseCase } from '../application/delete-diary-entry.use-case';
import { DiariesService } from '../application/diaries.service';
import { GetDailyMemoryUseCase } from '../application/get-daily-memory.use-case';
import { GetDiaryFeedUseCase } from '../application/get-diary-feed.use-case';
import { GetMoodStatsUseCase } from '../application/get-mood-stats.use-case';
import { GetStreakUseCase } from '../application/get-streak.use-case';
import { SetDiaryFavoriteUseCase } from '../application/set-diary-favorite.use-case';
import { DiaryEntryNotFoundError } from '../domain/diary-entry-not-found.error';
import { MAX_ENTRY_PHOTOS } from '../domain/diary-entry.repository';
import { InvalidDiaryPhotoError } from '../domain/invalid-diary-photo.error';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { InvalidFeedCursorError } from '../domain/invalid-feed-cursor.error';
import { LocalDateOutOfRangeError } from '../domain/local-date-out-of-range.error';
import { SongNotFoundError } from '../domain/song-not-found.error';
import { SongCatalogUnavailableError } from '../../songs/domain/song-catalog-unavailable.error';
import { DailyMemoryResponseDto } from './dto/daily-memory-response.dto';
import { DiaryEntryResponseDto } from './dto/diary-entry-response.dto';
import { DiaryFeedPageDto } from './dto/diary-feed-page.dto';
import { GetDailyMemoryQueryDto } from './dto/get-daily-memory-query.dto';
import { GetDiaryFeedQueryDto } from './dto/get-diary-feed-query.dto';
import { GetStreakQueryDto } from './dto/get-streak-query.dto';
import { ListDiaryEntriesQueryDto } from './dto/list-diary-entries-query.dto';
import { MoodStatsResponseDto } from './dto/mood-stats-response.dto';
import { SetDiaryFavoriteDto } from './dto/set-diary-favorite.dto';
import { StreakResponseDto } from './dto/streak-response.dto';
import { UpsertDiaryEntryDto } from './dto/upsert-diary-entry.dto';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('diaries')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('diaries')
export class DiariesController {
  constructor(
    private readonly diariesService: DiariesService,
    private readonly getDailyMemoryUseCase: GetDailyMemoryUseCase,
    private readonly getStreakUseCase: GetStreakUseCase,
    private readonly getDiaryFeedUseCase: GetDiaryFeedUseCase,
    private readonly getMoodStatsUseCase: GetMoodStatsUseCase,
    private readonly setDiaryFavoriteUseCase: SetDiaryFavoriteUseCase,
    private readonly deleteDiaryEntryUseCase: DeleteDiaryEntryUseCase,
  ) {}

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
        songId: {
          type: 'string',
          example: '1445931937',
          description: 'Song id from GET /songs/search. Omit to keep the current song, empty string to remove it.',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Entry created or updated for that date', type: DiaryEntryResponseDto })
  @ApiBadRequestResponse({
    description: "Invalid date, mood, note, photo or song, or a new entry for a day other than the user's local today",
  })
  @ApiBadGatewayResponse({ description: 'Song catalog is unavailable' })
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
        songId: dto.songId,
      });
      return DiaryEntryResponseDto.fromEntity(entry);
    } catch (error) {
      if (error instanceof InvalidEntryDateError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof LocalDateOutOfRangeError) {
        throw new BadRequestException("Past or future days can't be written. Only today's entry can be added.");
      }
      if (error instanceof SongNotFoundError) {
        throw new BadRequestException('Song not found');
      }
      if (error instanceof SongCatalogUnavailableError) {
        throw new BadGatewayException("Couldn't reach the song catalog. Please try again.");
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

  @Get('feed')
  @ApiOkResponse({ description: "The user's entries, newest first, cursor-paginated", type: DiaryFeedPageDto })
  @ApiBadRequestResponse({ description: 'Invalid mood, month, favorite, limit or cursor' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async getFeed(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: GetDiaryFeedQueryDto,
  ): Promise<DiaryFeedPageDto> {
    try {
      const page = await this.getDiaryFeedUseCase.execute({
        userId: payload.sub,
        mood: query.mood,
        month: query.month,
        favorite: query.favorite,
        limit: query.limit,
        cursor: query.cursor,
      });
      return DiaryFeedPageDto.from(page);
    } catch (error) {
      if (error instanceof InvalidFeedCursorError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':date/favorite')
  @ApiOkResponse({ description: 'The entry with its favorite flag updated', type: DiaryEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date or isFavorite' })
  @ApiNotFoundResponse({ description: 'No entry on that date' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async setFavorite(
    @CurrentUser() payload: AccessTokenPayload,
    @Param('date') date: string,
    @Body() dto: SetDiaryFavoriteDto,
  ): Promise<DiaryEntryResponseDto> {
    try {
      const entry = await this.setDiaryFavoriteUseCase.execute({
        userId: payload.sub,
        date,
        isFavorite: dto.isFavorite,
      });
      return DiaryEntryResponseDto.fromEntity(entry);
    } catch (error) {
      throw toEntryByDateHttpError(error);
    }
  }

  @Delete(':date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Entry deleted (soft delete)' })
  @ApiBadRequestResponse({ description: 'Invalid date' })
  @ApiNotFoundResponse({ description: 'No entry on that date' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async delete(@CurrentUser() payload: AccessTokenPayload, @Param('date') date: string): Promise<void> {
    try {
      await this.deleteDiaryEntryUseCase.execute({ userId: payload.sub, date });
    } catch (error) {
      throw toEntryByDateHttpError(error);
    }
  }

  @Get('stats')
  @ApiOkResponse({ description: 'Mood statistics for the month, with the previous month to compare', type: MoodStatsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid month' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async getStats(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: ListDiaryEntriesQueryDto,
  ): Promise<MoodStatsResponseDto> {
    const stats = await this.getMoodStatsUseCase.execute({ userId: payload.sub, month: query.month });
    return MoodStatsResponseDto.fromStats(stats);
  }

  @Get('memory/today')
  @ApiOkResponse({ description: "Today's memory: an older entry of the user, or null", type: DailyMemoryResponseDto })
  @ApiBadRequestResponse({ description: "Invalid date, or not the user's local today" })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async getDailyMemory(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: GetDailyMemoryQueryDto,
  ): Promise<DailyMemoryResponseDto> {
    try {
      const memory = await this.getDailyMemoryUseCase.execute({ userId: payload.sub, today: query.date });
      return DailyMemoryResponseDto.from(memory);
    } catch (error) {
      if (error instanceof InvalidEntryDateError || error instanceof LocalDateOutOfRangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('streak')
  @ApiOkResponse({ description: "The user's writing streak", type: StreakResponseDto })
  @ApiBadRequestResponse({ description: "Invalid date, or not the user's local today" })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async getStreak(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: GetStreakQueryDto,
  ): Promise<StreakResponseDto> {
    try {
      const streak = await this.getStreakUseCase.execute({ userId: payload.sub, today: query.date });
      return StreakResponseDto.from(streak);
    } catch (error) {
      if (error instanceof InvalidEntryDateError || error instanceof LocalDateOutOfRangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

// Shared by the routes that address one entry by its :date.
function toEntryByDateHttpError(error: unknown): unknown {
  if (error instanceof InvalidEntryDateError) return new BadRequestException(error.message);
  if (error instanceof DiaryEntryNotFoundError) return new NotFoundException(error.message);
  return error;
}
