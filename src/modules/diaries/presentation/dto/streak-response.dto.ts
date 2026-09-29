import { ApiProperty } from '@nestjs/swagger';
import { Streak } from '../../application/get-streak.use-case';

export class StreakResponseDto {
  @ApiProperty({
    example: 5,
    description: 'Consecutive days ending today, or yesterday if today has no entry yet',
  })
  current: number;

  @ApiProperty({ example: 21, description: 'Longest run of consecutive days ever' })
  longest: number;

  @ApiProperty({ example: false, description: 'Whether the user already wrote an entry today' })
  writtenToday: boolean;

  static from(streak: Streak): StreakResponseDto {
    const dto = new StreakResponseDto();
    dto.current = streak.current;
    dto.longest = streak.longest;
    dto.writtenToday = streak.writtenToday;
    return dto;
  }
}
