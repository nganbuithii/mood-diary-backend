import { Inject, Injectable } from '@nestjs/common';
import { DAY_MS, parseLocalToday } from '../../diaries/application/calendar-date';
import { computeStreak } from '../../diaries/application/get-streak.use-case';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_TIERS,
  AchievementId,
  COMEBACK_BREAK_DAYS,
  MONTHLY_PAGE_GOAL,
  levelFor,
} from '../domain/achievement-catalog';
import {
  ACHIEVEMENT_REPOSITORY,
  AchievementEntry,
  AchievementRepository,
  ReachedLevel,
} from '../domain/achievement.repository';

export interface GetAchievementsInput {
  userId: string;
  today: string;
}

export interface AchievementProgress {
  id: AchievementId;
  level: number;
  seenLevel: number;
  value: number;
  tiers: readonly number[];
}

export interface MonthlyBadge {
  month: string;
  pages: number;
  goal: number;
  earned: boolean;
}

export interface Achievements {
  stats: { currentStreak: number; longestStreak: number; totalPages: number };
  achievements: AchievementProgress[];
  monthly: MonthlyBadge[];
}

@Injectable()
export class GetAchievementsUseCase {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY) private readonly achievementRepository: AchievementRepository,
  ) {}

  async execute(input: GetAchievementsInput, now: Date = new Date()): Promise<Achievements> {
    const today = parseLocalToday(input.today, now);
    const [entries, letters, storedLevels] = await Promise.all([
      this.achievementRepository.findEntries(input.userId),
      this.achievementRepository.countLetters(input.userId),
      this.achievementRepository.findLevels(input.userId),
    ]);

    const entryDates = entries.map((entry) => entry.entryDate);    const streak = computeStreak(
      entryDates.filter((date) => date <= today),
      today,
    );
    const values: Record<AchievementId, number> = {
      pages: entries.length,
      streak: streak.longest,
      photos: entries.filter((entry) => entry.hasPhoto).length,
      songs: entries.filter((entry) => entry.hasSong).length,
      favorites: entries.filter((entry) => entry.isFavorite).length,
      letters,
      rainbow: new Set(entries.map((entry) => entry.mood)).size,
      comeback: countComebacks(entryDates),
    };

    const stored = new Map(storedLevels.map((row) => [row.achievementId, row]));
    const raised: ReachedLevel[] = [];
    const achievements = ACHIEVEMENT_IDS.map((id): AchievementProgress => {
      const tiers = ACHIEVEMENT_TIERS[id];
      const reached = levelFor(tiers, values[id]);
      const storedLevel = stored.get(id)?.level ?? 0;
      
      if (reached > storedLevel) raised.push({ achievementId: id, level: reached });

      return {
        id,
        level: Math.max(reached, storedLevel),
        seenLevel: stored.get(id)?.seenLevel ?? 0,
        value: values[id],
        tiers,
      };
    });
    if (raised.length > 0) await this.achievementRepository.raiseLevels(input.userId, raised);

    return {
      stats: {
        currentStreak: streak.current,
        longestStreak: streak.longest,
        totalPages: entries.length,
      },
      achievements,
      monthly: monthlyBadges(entries, toMonthKey(today)),
    };
  }
}

// entryDates must be newest first.
function countComebacks(entryDates: Date[]): number {
  return entryDates.filter(
    (date, index) =>
      index > 0 &&
      (entryDates[index - 1].getTime() - date.getTime()) / DAY_MS > COMEBACK_BREAK_DAYS,
  ).length;
}

// The current month, then every month that reached the goal; missed months are left out.
function monthlyBadges(entries: AchievementEntry[], currentMonth: string): MonthlyBadge[] {
  const pagesByMonth = new Map<string, number>();
  for (const { entryDate } of entries) {
    const month = toMonthKey(entryDate);
    pagesByMonth.set(month, (pagesByMonth.get(month) ?? 0) + 1);
  }
  const months = [...pagesByMonth]
    .filter(([month, pages]) => month < currentMonth && pages >= MONTHLY_PAGE_GOAL)
    .map(([month]) => month);

  return [currentMonth, ...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const pages = pagesByMonth.get(month) ?? 0;
      return { month, pages, goal: MONTHLY_PAGE_GOAL, earned: pages >= MONTHLY_PAGE_GOAL };
    });
}

function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}
