import { ApiProperty } from '@nestjs/swagger';
import { DIARY_MOODS, DiaryEntryEntity, DiaryMood } from '../../domain/diary-entry.repository';
import { SongResponseDto } from '../../../songs/presentation/dto/song-response.dto';

export class DiaryEntryResponseDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: '2026-09-25', description: 'Entry date, YYYY-MM-DD' })
  date: string;

  @ApiProperty({ enum: DIARY_MOODS, example: 'HAPPY' })
  mood: DiaryMood;

  @ApiProperty({ nullable: true, example: 'Coffee with an old friend, felt so nice.' })
  note: string | null;

  @ApiProperty({ type: [String], example: ['https://res.cloudinary.com/demo/image/upload/v1/mood-diary/diary-photos/user-1/abc.jpg'] })
  photoUrls: string[];

  @ApiProperty({ type: SongResponseDto, nullable: true })
  song: SongResponseDto | null;

  @ApiProperty({ example: '2026-09-25T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-25T10:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(entry: DiaryEntryEntity): DiaryEntryResponseDto {
    const dto = new DiaryEntryResponseDto();
    dto.id = entry.id;
    dto.date = toDateKey(entry.entryDate);
    dto.mood = entry.mood;
    dto.note = entry.note;
    dto.photoUrls = entry.photoUrls;
    dto.song =
      entry.songExternalId && entry.songTitle && entry.songArtist
        ? SongResponseDto.fromSong({
            id: entry.songExternalId,
            title: entry.songTitle,
            artist: entry.songArtist,
            artworkUrl: entry.songArtworkUrl,
            previewUrl: entry.songPreviewUrl,
          })
        : null;
    dto.createdAt = entry.createdAt;
    dto.updatedAt = entry.updatedAt;
    return dto;
  }
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
