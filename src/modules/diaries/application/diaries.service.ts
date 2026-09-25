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

export interface UpsertDiaryEntryRequest {
  userId: string;
  date: string;
  mood: DiaryMood;
  note?: string | null;
  photos?: Buffer[];
}

@Injectable()
export class DiariesService {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
    @Inject(DIARY_PHOTO_STORAGE) private readonly diaryPhotoStorage: DiaryPhotoStorage,
  ) {}

  async upsertEntry(input: UpsertDiaryEntryRequest): Promise<DiaryEntryEntity> {
    // Validate before uploading: an invalid date shouldn't cost a wasted
    // (and orphaned) Cloudinary upload.
    const entryDate = parseCalendarDate(input.date);
    const note = input.note?.trim();
    const photoFiles = (input.photos ?? []).slice(0, MAX_ENTRY_PHOTOS);
    const photoUrls = await Promise.all(
      photoFiles.map((file) => this.diaryPhotoStorage.upload(input.userId, file).then((result) => result.url)),
    );

    return this.diaryEntryRepository.upsert({
      userId: input.userId,
      entryDate,
      mood: input.mood,
      note: note ? note : null,
      photoUrls,
    });
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
