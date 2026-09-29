import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DIARY_MOODS, DiaryMood } from '../../domain/diary-entry.repository';

export const DEFAULT_FEED_LIMIT = 12;
export const MAX_FEED_LIMIT = 50;

export class GetDiaryFeedQueryDto {
  @ApiPropertyOptional({ enum: DIARY_MOODS, example: 'HAPPY', description: 'Only entries with this mood' })
  @IsOptional()
  @IsIn(DIARY_MOODS, { message: `mood must be one of: ${DIARY_MOODS.join(', ')}` })
  mood?: DiaryMood;

  @ApiPropertyOptional({ example: '2026-09', description: 'Only entries dated in this month, YYYY-MM' })
  @IsOptional()
  @Matches(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @ApiPropertyOptional({ default: DEFAULT_FEED_LIMIT, minimum: 1, maximum: MAX_FEED_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FEED_LIMIT)
  limit: number = DEFAULT_FEED_LIMIT;

  @ApiPropertyOptional({ description: "Opaque cursor from the previous page's nextCursor. Omit for the first page." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}
