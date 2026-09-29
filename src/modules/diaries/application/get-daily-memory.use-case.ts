import { Inject, Injectable } from '@nestjs/common';
import {
  DIARY_ENTRY_REPOSITORY,
  DiaryEntryEntity,
  DiaryEntryRepository,
} from '../domain/diary-entry.repository';
import { MemoryDateOutOfRangeError } from '../domain/memory-date-out-of-range.error';
import { parseCalendarDate } from './calendar-date';

export const MIN_MEMORY_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GetDailyMemoryInput {
  userId: string;
  today: string;
}

export interface DailyMemory {
  entry: DiaryEntryEntity;
  relativeLabel: string;
}

@Injectable()
export class GetDailyMemoryUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: GetDailyMemoryInput, now: Date = new Date()): Promise<DailyMemory | null> {
    const today = parseCalendarDate(input.today);
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (Math.abs(today.getTime() - utcToday) > DAY_MS) {
      throw new MemoryDateOutOfRangeError(input.today);
    }

    const entry = await this.pickEntry(input.userId, today, input.today);
    return entry ? { entry, relativeLabel: relativeLabel(entry.entryDate, today) } : null;
  }

  private async pickEntry(
    userId: string,
    today: Date,
    todayKey: string,
  ): Promise<DiaryEntryEntity | null> {
    for (const date of [shiftMonths(today, -12), shiftMonths(today, -1)]) {
      if (!date) continue;
      const entry = await this.diaryEntryRepository.findByUserAndDate(userId, date);
      if (entry) return entry;
    }

    const cutoff = new Date(today.getTime() - MIN_MEMORY_AGE_DAYS * DAY_MS);
    const count = await this.diaryEntryRepository.countByUserOnOrBefore(userId, cutoff);
    if (count === 0) return null;

    const offset = stableHash(`${userId}:${todayKey}`) % count;
    return this.diaryEntryRepository.findByUserOnOrBeforeAt(userId, cutoff, offset);
  }
}

function shiftMonths(date: Date, months: number): Date | null {
  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, day));
  return shifted.getUTCDate() === day ? shifted : null;
}

function relativeLabel(entryDate: Date, today: Date): string {
  const months =
    (today.getUTCFullYear() - entryDate.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - entryDate.getUTCMonth()) -
    (today.getUTCDate() < entryDate.getUTCDate() ? 1 : 0);

  if (months >= 12) return plural(Math.floor(months / 12), 'year');
  if (months >= 1) return plural(months, 'month');
  return plural(Math.round((today.getTime() - entryDate.getTime()) / DAY_MS), 'day');
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
