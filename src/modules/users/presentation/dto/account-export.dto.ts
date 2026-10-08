import { ApiProperty } from '@nestjs/swagger';
import { MOODS, Mood } from '../../../../shared/mood';
import { toDateKey } from '../../../diaries/presentation/dto/diary-entry-response.dto';
import type { LetterStatus } from '../../../letters/domain/letter-status';
import { AccountExport } from '../../application/export-account.use-case';

export const ACCOUNT_EXPORT_FORMAT = 'mood-diary-export';
export const ACCOUNT_EXPORT_VERSION = 1;

class ExportedProfileDto {
  @ApiProperty({ example: 'test@example.com' })
  email: string;

  @ApiProperty({ example: 'Ngân' })
  displayName: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: Date;
}

class ExportedSongDto {
  @ApiProperty({ nullable: true, type: String })
  externalId: string | null;

  @ApiProperty({ example: 'Hẹn Ngày Mai Yêu' })
  title: string;

  @ApiProperty({ nullable: true, type: String })
  artist: string | null;

  @ApiProperty({ nullable: true, type: String })
  artworkUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  previewUrl: string | null;
}

class ExportedEntryDto {
  @ApiProperty({ example: '2026-10-08', description: 'Local calendar day (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ enum: MOODS })
  mood: Mood;

  @ApiProperty({ nullable: true, type: String })
  note: string | null;

  @ApiProperty({ type: [String] })
  photoUrls: string[];

  @ApiProperty()
  isFavorite: boolean;

  @ApiProperty({ type: ExportedSongDto, nullable: true })
  song: ExportedSongDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

class ExportedLetterDto {
  @ApiProperty({ enum: ['sealed', 'ready', 'opened'] })
  status: LetterStatus;

  @ApiProperty({ nullable: true, type: String, description: 'null while the letter is still sealed' })
  body: string | null;

  @ApiProperty({ enum: MOODS, nullable: true })
  moodAtWriting: Mood | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  deliverAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  openedAt: Date | null;
}

export class AccountExportDto {
  @ApiProperty({ example: ACCOUNT_EXPORT_FORMAT })
  format: string;

  @ApiProperty({ example: ACCOUNT_EXPORT_VERSION })
  version: number;

  @ApiProperty()
  exportedAt: Date;

  @ApiProperty({ type: ExportedProfileDto })
  profile: ExportedProfileDto;

  @ApiProperty({ type: [ExportedEntryDto] })
  entries: ExportedEntryDto[];

  @ApiProperty({ type: [ExportedLetterDto] })
  letters: ExportedLetterDto[];

  static fromExport(data: AccountExport): AccountExportDto {
    const dto = new AccountExportDto();
    dto.format = ACCOUNT_EXPORT_FORMAT;
    dto.version = ACCOUNT_EXPORT_VERSION;
    dto.exportedAt = data.exportedAt;
    dto.profile = { ...data.profile };
    dto.entries = data.entries.map((entry) => ({
      date: toDateKey(entry.entryDate),
      mood: entry.mood,
      note: entry.note,
      photoUrls: entry.photoUrls,
      isFavorite: entry.isFavorite,
      song: entry.songTitle
        ? {
            externalId: entry.songExternalId,
            title: entry.songTitle,
            artist: entry.songArtist,
            artworkUrl: entry.songArtworkUrl,
            previewUrl: entry.songPreviewUrl,
          }
        : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
    dto.letters = data.letters.map((letter) => ({
      status: letter.status,
      body: letter.body,
      moodAtWriting: letter.moodAtWriting,
      createdAt: letter.createdAt,
      deliverAt: letter.deliverAt,
      openedAt: letter.openedAt,
    }));
    return dto;
  }
}
