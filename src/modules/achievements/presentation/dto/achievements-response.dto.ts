import { ApiProperty } from '@nestjs/swagger';
import { ACHIEVEMENT_IDS, AchievementId } from '../../domain/achievement-catalog';
import { Achievements } from '../../application/get-achievements.use-case';

export class AchievementStatsDto {
  @ApiProperty({
    example: 4,
    description: 'Consecutive days ending today, or yesterday if today has no entry yet',
  })
  currentStreak: number;

  @ApiProperty({ example: 14, description: 'Longest run of consecutive days ever' })
  longestStreak: number;

  @ApiProperty({ example: 42, description: 'Live (not deleted) diary entries' })
  totalPages: number;
}

export class AchievementProgressDto {
  @ApiProperty({ enum: ACHIEVEMENT_IDS, example: 'pages' })
  id: AchievementId;

  @ApiProperty({
    example: 2,
    description: 'Tiers reached; never goes down, even after pages are deleted',
  })
  level: number;

  @ApiProperty({
    example: 1,
    description: 'Highest level already looked at; anything above it is new',
  })
  seenLevel: number;

  @ApiProperty({ example: 15, description: 'Current value measured against the tiers' })
  value: number;

  @ApiProperty({ type: [Number], example: [1, 10, 30, 100, 200, 365] })
  tiers: number[];
}

export class MonthlyBadgeDto {
  @ApiProperty({ example: '2026-10', description: 'YYYY-MM' })
  month: string;

  @ApiProperty({ example: 12, description: 'Live entries dated in that month' })
  pages: number;

  @ApiProperty({ example: 10 })
  goal: number;

  @ApiProperty({ example: true })
  earned: boolean;
}

export class AchievementsResponseDto {
  @ApiProperty({ type: AchievementStatsDto })
  stats: AchievementStatsDto;

  @ApiProperty({ type: [AchievementProgressDto] })
  achievements: AchievementProgressDto[];

  @ApiProperty({
    type: [MonthlyBadgeDto],
    description:
      'The current month followed by every earned month, newest first; missed months are left out',
  })
  monthly: MonthlyBadgeDto[];

  static from(result: Achievements): AchievementsResponseDto {
    const dto = new AchievementsResponseDto();
    dto.stats = Object.assign(new AchievementStatsDto(), result.stats);
    dto.achievements = result.achievements.map((item) =>
      Object.assign(new AchievementProgressDto(), { ...item, tiers: [...item.tiers] }),
    );
    dto.monthly = result.monthly.map((badge) => Object.assign(new MonthlyBadgeDto(), badge));
    return dto;
  }
}
