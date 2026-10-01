import { ApiProperty } from '@nestjs/swagger';
import { DIARY_MOODS, DiaryMood } from '../../domain/diary-entry.repository';
import { MoodPeriodStats, MoodStats } from '../../application/get-mood-stats.use-case';

const MOOD_COUNTS_EXAMPLE = { VERY_SAD: 1, SAD: 2, NEUTRAL: 5, HAPPY: 7, VERY_HAPPY: 3 };

export class MoodPeriodStatsDto {
  @ApiProperty({ example: '2026-09', description: 'YYYY-MM' })
  month: string;

  @ApiProperty({ example: 30 })
  daysInMonth: number;

  @ApiProperty({ example: 18, description: 'Days with an entry (one entry per day)' })
  writtenDays: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: MOOD_COUNTS_EXAMPLE,
    description: 'Days per mood; every mood is present, 0 when unused',
  })
  moodCounts: Record<DiaryMood, number>;

  @ApiProperty({
    enum: DIARY_MOODS,
    nullable: true,
    example: 'HAPPY',
    description: 'Most frequent mood; null when the month is empty or two moods tie',
  })
  topMood: DiaryMood | null;

  @ApiProperty({
    nullable: true,
    example: 3.44,
    description: 'Average mood score from 1 (VERY_SAD) to 5 (VERY_HAPPY); null when the month is empty',
  })
  averageScore: number | null;

  static from(stats: MoodPeriodStats): MoodPeriodStatsDto {
    const dto = new MoodPeriodStatsDto();
    dto.month = stats.month;
    dto.daysInMonth = stats.daysInMonth;
    dto.writtenDays = stats.writtenDays;
    dto.moodCounts = stats.moodCounts;
    dto.topMood = stats.topMood;
    dto.averageScore = stats.averageScore;
    return dto;
  }
}

export class MoodStatsResponseDto extends MoodPeriodStatsDto {
  @ApiProperty({ type: MoodPeriodStatsDto, description: 'The same numbers for the month before, to compare' })
  previous: MoodPeriodStatsDto;

  static fromStats(stats: MoodStats): MoodStatsResponseDto {
    const dto = Object.assign(new MoodStatsResponseDto(), MoodPeriodStatsDto.from(stats));
    dto.previous = MoodPeriodStatsDto.from(stats.previous);
    return dto;
  }
}
