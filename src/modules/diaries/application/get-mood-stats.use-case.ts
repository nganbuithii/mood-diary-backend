import { Inject, Injectable } from '@nestjs/common';
import {
  DIARY_ENTRY_REPOSITORY,
  DIARY_MOODS,
  DiaryEntryRepository,
  DiaryMood,
  MoodCount,
} from '../domain/diary-entry.repository';
import { DAY_MS, monthRange } from './calendar-date';

// 1 (worst) to 5 (best), in the order of DIARY_MOODS.
const MOOD_SCORE: Record<DiaryMood, number> = Object.fromEntries(
  DIARY_MOODS.map((mood, index) => [mood, index + 1]),
) as Record<DiaryMood, number>;

export interface GetMoodStatsInput {
  userId: string;
  month: string;
}

export interface MoodPeriodStats {
  month: string;
  daysInMonth: number;
  /** One entry per day, so this is also the number of entries. */
  writtenDays: number;
  moodCounts: Record<DiaryMood, number>;
  /** Null when the month is empty or two moods tie for first. */
  topMood: DiaryMood | null;
  /** Mean of the 1–5 mood scores, rounded to 2 decimals; null when the month is empty. */
  averageScore: number | null;
}

export interface MoodStats extends MoodPeriodStats {
  previous: MoodPeriodStats;
}

@Injectable()
export class GetMoodStatsUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: GetMoodStatsInput): Promise<MoodStats> {
    const previousMonth = shiftMonth(input.month, -1);
    const [current, previous] = await Promise.all([
      this.statsFor(input.userId, input.month),
      this.statsFor(input.userId, previousMonth),
    ]);
    return { ...current, previous };
  }

  private async statsFor(userId: string, month: string): Promise<MoodPeriodStats> {
    const { from, to } = monthRange(month);
    const counts = await this.diaryEntryRepository.countMoodsInRange(userId, from, to);
    return {
      month,
      daysInMonth: Math.round((to.getTime() - from.getTime()) / DAY_MS),
      ...summarize(counts),
    };
  }
}

function summarize(counts: MoodCount[]): Omit<MoodPeriodStats, 'month' | 'daysInMonth'> {
  const moodCounts = Object.fromEntries(DIARY_MOODS.map((mood) => [mood, 0])) as Record<DiaryMood, number>;
  for (const { mood, count } of counts) moodCounts[mood] = count;

  const writtenDays = DIARY_MOODS.reduce((sum, mood) => sum + moodCounts[mood], 0);
  if (writtenDays === 0) {
    return { writtenDays, moodCounts, topMood: null, averageScore: null };
  }

  const highest = Math.max(...DIARY_MOODS.map((mood) => moodCounts[mood]));
  const leaders = DIARY_MOODS.filter((mood) => moodCounts[mood] === highest);
  const totalScore = DIARY_MOODS.reduce((sum, mood) => sum + moodCounts[mood] * MOOD_SCORE[mood], 0);

  return {
    writtenDays,
    moodCounts,
    // A tie has no honest single answer; the client shows it as a mixed month.
    topMood: leaders.length === 1 ? leaders[0] : null,
    averageScore: Math.round((totalScore / writtenDays) * 100) / 100,
  };
}

function shiftMonth(month: string, delta: number): string {
  const { from } = monthRange(month);
  const shifted = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + delta, 1));
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}
