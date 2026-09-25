import { Inject, Injectable } from '@nestjs/common';
import {
  DIARY_ENTRY_REPOSITORY,
  DiaryEntryEntity,
  DiaryEntryRepository,
  DiaryMood,
} from '../domain/diary-entry.repository';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';

export interface UpsertDiaryEntryRequest {
  userId: string;
  date: string;
  mood: DiaryMood;
  note?: string | null;
}

@Injectable()
export class DiariesService {
  constructor(@Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository) {}

  async upsertEntry(input: UpsertDiaryEntryRequest): Promise<DiaryEntryEntity> {
    const note = input.note?.trim();

    return this.diaryEntryRepository.upsert({
      userId: input.userId,
      entryDate: parseCalendarDate(input.date),
      mood: input.mood,
      note: note ? note : null,
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
