import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class GetAchievementsQueryDto {
  @ApiProperty({ example: '2026-11-09', description: "User's local date today, YYYY-MM-DD" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date: string;
}
