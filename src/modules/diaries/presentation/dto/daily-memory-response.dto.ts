import { ApiProperty } from '@nestjs/swagger';
import { DailyMemory } from '../../application/get-daily-memory.use-case';
import { DIARY_MOODS, DiaryMood } from '../../domain/diary-entry.repository';
import { toDateKey } from './diary-entry-response.dto';

export class MemoryDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ enum: DIARY_MOODS, example: 'VERY_HAPPY' })
  mood: DiaryMood;

  @ApiProperty({ example: '2026-06-28', description: 'Entry date, YYYY-MM-DD' })
  entryDate: string;

  @ApiProperty({ example: '3 months ago' })
  relativeLabel: string;

  @ApiProperty({ nullable: true, example: 'Finished my side project today!' })
  content: string | null;

  @ApiProperty({ nullable: true, description: 'First photo of the entry, if any' })
  photoUrl: string | null;
}

export class DailyMemoryResponseDto {
  @ApiProperty({
    type: MemoryDto,
    nullable: true,
    description: 'null when the user has no entry old enough',
  })
  memory: MemoryDto | null;

  static from(memory: DailyMemory | null): DailyMemoryResponseDto {
    const dto = new DailyMemoryResponseDto();
    
    if (!memory) {
      dto.memory = null;
      return dto;
    }

    const { entry } = memory;
    dto.memory = {
      id: entry.id,
      mood: entry.mood,
      entryDate: toDateKey(entry.entryDate),
      relativeLabel: memory.relativeLabel,
      content: entry.note,
      photoUrl: entry.photoUrls[0] ?? null,
    };
    return dto;
  }
}
