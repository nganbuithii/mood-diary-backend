import { Inject, Injectable } from '@nestjs/common';
import {
  DIARY_ENTRY_REPOSITORY,
  DiaryEntryEntity,
  DiaryEntryRepository,
  DiaryMood,
} from '../domain/diary-entry.repository';
import { InvalidFeedCursorError } from '../domain/invalid-feed-cursor.error';
import { monthRange, parseCalendarDate } from './calendar-date';

export interface GetDiaryFeedInput {
  userId: string;
  mood?: DiaryMood;
  month?: string;
  limit: number;
  cursor?: string;
}

export interface DiaryFeedPage {
  entries: DiaryEntryEntity[];
  nextCursor: string | null;
}

@Injectable()
export class GetDiaryFeedUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: GetDiaryFeedInput): Promise<DiaryFeedPage> {
    if (input.limit < 1) {
      throw new RangeError(`limit must be at least 1, got ${input.limit}`);
    }

    const before = input.cursor === undefined ? undefined : decodeCursor(input.cursor, input);
    const range = input.month === undefined ? undefined : monthRange(input.month);

    const rows = await this.diaryEntryRepository.findPageNewestFirst({
      userId: input.userId,
      mood: input.mood,
      from: range?.from,
      to: range?.to,
      before,
      take: input.limit + 1,
    });

    const entries = rows.slice(0, input.limit);
    const hasMore = rows.length > input.limit;
    return {
      entries,
      nextCursor: hasMore ? encodeCursor(entries[entries.length - 1].entryDate, input) : null,
    };
  }
}

// The cursor also carries the filters, so it only continues the feed it came from.
function encodeCursor(entryDate: Date, input: GetDiaryFeedInput): string {
  const cursor = { d: entryDate.toISOString().slice(0, 10), mood: input.mood, month: input.month };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(cursor: string, input: GetDiaryFeedInput): Date {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.d === 'string' && parsed.mood === input.mood && parsed.month === input.month) {
      return parseCalendarDate(parsed.d);
    }
  } catch {
    // Not base64 JSON, or not a real date: rejected below.
  }
  throw new InvalidFeedCursorError();
}
