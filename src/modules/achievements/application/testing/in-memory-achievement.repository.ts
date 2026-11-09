import {
  AchievementEntry,
  AchievementRepository,
  ReachedLevel,
  StoredAchievementLevel,
} from '../../domain/achievement.repository';

export class InMemoryAchievementRepository implements AchievementRepository {
  constructor(
    public entries: AchievementEntry[] = [],
    public levels: StoredAchievementLevel[] = [],
    public letters = 0,
  ) {}

  findEntries(): Promise<AchievementEntry[]> {
    return Promise.resolve(this.entries);
  }

  countLetters(): Promise<number> {
    return Promise.resolve(this.letters);
  }

  findLevels(): Promise<StoredAchievementLevel[]> {
    return Promise.resolve(this.levels.map((row) => ({ ...row })));
  }

  raiseLevels(_userId: string, levels: ReachedLevel[]): Promise<void> {
    for (const { achievementId, level } of levels) {
      const row = this.levels.find((item) => item.achievementId === achievementId);
      if (!row) this.levels.push({ achievementId, level, seenLevel: 0 });
      else row.level = Math.max(row.level, level);
    }
    return Promise.resolve();
  }

  markSeen(_userId: string, achievementId: string): Promise<void> {
    const row = this.levels.find((item) => item.achievementId === achievementId);
    if (row) row.seenLevel = row.level;
    return Promise.resolve();
  }
}

export function entriesEndingAt(
  last: string,
  count: number,
  overrides: Partial<AchievementEntry> = {},
): AchievementEntry[] {
  const end = new Date(`${last}T00:00:00.000Z`).getTime();
  return Array.from({ length: count }, (_, index) => ({
    entryDate: new Date(end - index * 24 * 60 * 60 * 1000),
    mood: 'HAPPY',
    hasPhoto: false,
    hasSong: false,
    isFavorite: false,
    ...overrides,
  }));
}
