import { GetMoodStatsUseCase } from './get-mood-stats.use-case';
import { DiaryEntryEntity, DiaryEntryRepository, DiaryMood, MoodCount } from '../domain/diary-entry.repository';

interface StoredEntry {
  userId: string;
  entryDate: Date;
  mood: DiaryMood;
  deleted?: boolean;
}

function entry(date: string, mood: DiaryMood, userId = 'user-1', deleted = false): StoredEntry {
  return { userId, entryDate: new Date(`${date}T00:00:00.000Z`), mood, deleted };
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(private readonly entries: StoredEntry[]) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in stats tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in stats tests');
  }

  findByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in stats tests');
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in stats tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in stats tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in stats tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in stats tests');
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in stats tests');
  }

  findDeletedByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in stats tests');
  }

  softDelete(): Promise<boolean> {
    throw new Error('not used in stats tests');
  }

  findDeletedBefore(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in stats tests');
  }

  purge(): Promise<boolean> {
    throw new Error('not used in stats tests');
  }

  countMoodsInRange(userId: string, from: Date, to: Date): Promise<MoodCount[]> {
    const counts = new Map<DiaryMood, number>();
    for (const stored of this.entries) {
      if (stored.userId !== userId || stored.deleted || stored.entryDate < from || stored.entryDate >= to) continue;
      counts.set(stored.mood, (counts.get(stored.mood) ?? 0) + 1);
    }
    return Promise.resolve([...counts].map(([mood, count]) => ({ mood, count })));
  }
}

function setup(entries: StoredEntry[]) {
  return new GetMoodStatsUseCase(new InMemoryDiaryEntryRepository(entries));
}

const NO_MOODS = { VERY_SAD: 0, SAD: 0, NEUTRAL: 0, HAPPY: 0, VERY_HAPPY: 0 };

describe('GetMoodStatsUseCase', () => {
  it('counts days per mood, the top mood and the average score for the month', async () => {
    const useCase = setup([
      entry('2026-09-01', 'HAPPY'),
      entry('2026-09-02', 'HAPPY'),
      entry('2026-09-03', 'SAD'),
      entry('2026-09-30', 'VERY_HAPPY'),
    ]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-09' });

    expect(stats).toMatchObject({
      month: '2026-09',
      daysInMonth: 30,
      writtenDays: 4,
      moodCounts: { ...NO_MOODS, HAPPY: 2, SAD: 1, VERY_HAPPY: 1 },
      topMood: 'HAPPY',
      // (4 + 4 + 2 + 5) / 4
      averageScore: 3.75,
    });
  });

  it('includes the previous month to compare against', async () => {
    const useCase = setup([entry('2026-09-10', 'HAPPY'), entry('2026-08-31', 'SAD'), entry('2026-08-01', 'SAD')]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-09' });

    expect(stats.previous).toEqual({
      month: '2026-08',
      daysInMonth: 31,
      writtenDays: 2,
      moodCounts: { ...NO_MOODS, SAD: 2 },
      topMood: 'SAD',
      averageScore: 2,
    });
  });

  it('rolls the previous month back across a year boundary', async () => {
    const useCase = setup([entry('2025-12-25', 'VERY_HAPPY')]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-01' });

    expect(stats.previous).toMatchObject({ month: '2025-12', writtenDays: 1, topMood: 'VERY_HAPPY' });
  });

  it('returns zeros and nulls for an empty month', async () => {
    const stats = await setup([]).execute({ userId: 'user-1', month: '2026-09' });

    expect(stats).toMatchObject({ writtenDays: 0, moodCounts: NO_MOODS, topMood: null, averageScore: null });
    expect(stats.previous).toMatchObject({ writtenDays: 0, topMood: null, averageScore: null });
  });

  it('has no top mood when two moods tie for first', async () => {
    const useCase = setup([entry('2026-09-01', 'HAPPY'), entry('2026-09-02', 'SAD')]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-09' });

    expect(stats.topMood).toBeNull();
    expect(stats.averageScore).toBe(3);
  });

  it('rounds the average score to 2 decimals', async () => {
    const useCase = setup([entry('2026-09-01', 'HAPPY'), entry('2026-09-02', 'HAPPY'), entry('2026-09-03', 'SAD')]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-09' });

    // 10 / 3 = 3.333...
    expect(stats.averageScore).toBe(3.33);
  });

  it('knows how long each month is, leap years included', async () => {
    const useCase = setup([]);

    const [february2028, february2026, december] = await Promise.all([
      useCase.execute({ userId: 'user-1', month: '2028-02' }),
      useCase.execute({ userId: 'user-1', month: '2026-02' }),
      useCase.execute({ userId: 'user-1', month: '2026-12' }),
    ]);

    expect([february2028.daysInMonth, february2026.daysInMonth, december.daysInMonth]).toEqual([29, 28, 31]);
  });

  it("ignores deleted entries and other users' entries", async () => {
    const useCase = setup([
      entry('2026-09-01', 'HAPPY'),
      entry('2026-09-02', 'SAD', 'user-1', true),
      entry('2026-09-03', 'VERY_SAD', 'user-2'),
    ]);

    const stats = await useCase.execute({ userId: 'user-1', month: '2026-09' });

    expect(stats.moodCounts).toEqual({ ...NO_MOODS, HAPPY: 1 });
  });
});
