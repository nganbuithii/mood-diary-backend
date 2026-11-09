import { Mood } from '../../../shared/mood';

export interface AchievementEntry {
  entryDate: Date;
  mood: Mood;
  hasPhoto: boolean;
  hasSong: boolean;
  isFavorite: boolean;
}

export interface StoredAchievementLevel {
  achievementId: string;
  level: number;
  seenLevel: number;
}

export interface ReachedLevel {
  achievementId: string;
  level: number;
}

export interface AchievementRepository {
  /** Live (not soft-deleted) entries, newest first. */
  findEntries(userId: string): Promise<AchievementEntry[]>;
  countLetters(userId: string): Promise<number>;
  findLevels(userId: string): Promise<StoredAchievementLevel[]>;
  /** Only ever raises a stored level, so racing requests can never lower one. */
  raiseLevels(userId: string, levels: ReachedLevel[]): Promise<void>;
  markSeen(userId: string, achievementId: string): Promise<void>;
}

export const ACHIEVEMENT_REPOSITORY = Symbol('ACHIEVEMENT_REPOSITORY');
