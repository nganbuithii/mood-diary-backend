import { Inject, Injectable } from '@nestjs/common';
import {
  DIARY_ENTRY_REPOSITORY,
  DiaryEntryEntity,
  DiaryEntryRepository,
  DiaryMood,
  MAX_ENTRY_PHOTOS,
} from '../domain/diary-entry.repository';
import { DIARY_PHOTO_STORAGE, DiaryPhotoStorage } from '../domain/diary-photo-storage';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { SongNotFoundError } from '../domain/song-not-found.error';
import { SONG_CATALOG, Song, SongCatalog } from '../../songs/domain/song-catalog';

export interface UpsertDiaryEntryRequest {
  userId: string;
  date: string;
  mood: DiaryMood;
  note?: string | null;
  photos?: Buffer[];
  songId?: string;
}

@Injectable()
export class DiariesService {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
    @Inject(DIARY_PHOTO_STORAGE) private readonly diaryPhotoStorage: DiaryPhotoStorage,
    @Inject(SONG_CATALOG) private readonly songCatalog: SongCatalog,
  ) {}

  async upsertEntry(input: UpsertDiaryEntryRequest): Promise<DiaryEntryEntity> {
    const entryDate = parseCalendarDate(input.date);
    const song = await this.resolveSong(input.songId);
    const note = input.note?.trim();
    const photoFiles = (input.photos ?? []).slice(0, MAX_ENTRY_PHOTOS);
    const photoUrls =
      photoFiles.length > 0
        ? await Promise.all(
            photoFiles.map((file) => this.diaryPhotoStorage.upload(input.userId, file).then((result) => result.url)),
          )
        : undefined;

    return this.diaryEntryRepository.upsert({
      userId: input.userId,
      entryDate,
      mood: input.mood,
      note: note ? note : null,
      photoUrls,
      song,
    });
  }

  private async resolveSong(songId: string | undefined): Promise<Song | null | undefined> {
    if (songId === undefined) return undefined;
    if (songId === '') return null;

    const song = await this.songCatalog.findById(songId);
    if (!song) throw new SongNotFoundError(songId);
    return song;
  }

  listEntriesForMonth(userId: string, month: string): Promise<DiaryEntryEntity[]> {
    const { from, to } = monthRange(month);
    return this.diaryEntryRepository.findManyByUserInRange(userId, from, to);
  }
}

function parseCalendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidEntryDateError(value);
  }
  return date;
}

function monthRange(month: string): { from: Date; to: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1)),
  };
}
