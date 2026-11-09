export const ACHIEVEMENT_TIERS = {
  pages: [1, 10, 30, 100, 200, 365],
  streak: [3, 7, 14, 30, 60, 100],
  photos: [1, 10, 30, 100],
  songs: [1, 10, 30, 100],
  favorites: [1, 10, 30, 50],
  letters: [1, 3, 5, 10],
  rainbow: [3, 5],
  comeback: [1, 3, 5, 10],
} as const satisfies Record<string, readonly number[]>;

export type AchievementId = keyof typeof ACHIEVEMENT_TIERS;

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENT_TIERS) as AchievementId[];

export const MONTHLY_PAGE_GOAL = 10;

export const COMEBACK_BREAK_DAYS = 3;

export function isAchievementId(value: string): value is AchievementId {
  return (ACHIEVEMENT_IDS as string[]).includes(value);
}

export function levelFor(tiers: readonly number[], value: number): number {
  return tiers.filter((tier) => value >= tier).length;
}
