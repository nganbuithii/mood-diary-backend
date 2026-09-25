import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { DiariesService } from '../application/diaries.service';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { DiaryEntryResponseDto } from './dto/diary-entry-response.dto';
import { ListDiaryEntriesQueryDto } from './dto/list-diary-entries-query.dto';
import { UpsertDiaryEntryDto } from './dto/upsert-diary-entry.dto';

@ApiTags('diaries')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('diaries')
export class DiariesController {
  constructor(private readonly diariesService: DiariesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Entry created or updated for that date', type: DiaryEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date, mood or note' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async upsert(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: UpsertDiaryEntryDto,
  ): Promise<DiaryEntryResponseDto> {
    try {
      const entry = await this.diariesService.upsertEntry({
        userId: payload.sub,
        date: dto.date,
        mood: dto.mood,
        note: dto.note,
      });
      return DiaryEntryResponseDto.fromEntity(entry);
    } catch (error) {
      if (error instanceof InvalidEntryDateError) {
        throw new BadRequestException(error.message);
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
