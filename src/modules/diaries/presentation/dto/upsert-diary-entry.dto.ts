import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DIARY_MOODS, DiaryMood } from '../../domain/diary-entry.repository';

export class UpsertDiaryEntryDto {
  @ApiProperty({ example: '2026-09-25', description: 'Entry date, YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ enum: DIARY_MOODS, example: 'HAPPY' })
  @IsIn(DIARY_MOODS, { message: `mood must be one of: ${DIARY_MOODS.join(', ')}` })
  mood: DiaryMood;

  @ApiProperty({ required: false, maxLength: 2000, example: 'Coffee with an old friend, felt so nice.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
