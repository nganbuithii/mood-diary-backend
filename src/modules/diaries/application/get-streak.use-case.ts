import { Inject, Injectable } from '@nestjs/common';
import { DIARY_ENTRY_REPOSITORY, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DAY_MS, parseLocalToday } from './calendar-date';

export interface GetStreakInput {
  userId: string;
  today: string;
}

export interface Streak {
  current: number;
  longest: number;
  writtenToday: boolean;
}

@Injectable()
export class GetStreakUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: GetStreakInput, now: Date = new Date()): Promise<Streak> {
    const today = parseLocalToday(input.today, now);
    const entryDates = await this.diaryEntryRepository.findEntryDatesOnOrBefore(
      input.userId,
      today,
    );

    return computeStreak(entryDates, today);
  }
}

export function computeStreak(entryDates: Date[], today: Date): Streak {
  const days = entryDates.map(toDayNumber);
  const todayNumber = toDayNumber(today);
  const isAlive = days.length > 0 && todayNumber - days[0] <= 1;

  let current = 0;
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i - 1] - days[i] === 1 ? run + 1 : 1;
    // run === i + 1 while still inside the newest run.
    if (isAlive && run === i + 1) current = run;
    longest = Math.max(longest, run);
  }

  return { current, longest, writtenToday: days[0] === todayNumber };
}

function toDayNumber(date: Date): number {
  return Math.round(date.getTime() / DAY_MS);
}
