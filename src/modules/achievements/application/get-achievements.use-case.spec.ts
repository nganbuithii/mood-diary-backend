import { LocalDateOutOfRangeError } from '../../diaries/domain/local-date-out-of-range.error';
import { GetAchievementsUseCase } from './get-achievements.use-case';
import {
  InMemoryAchievementRepository,
  entriesEndingAt,
} from './testing/in-memory-achievement.repository';

const NOW = new Date('2026-11-09T10:00:00.000Z');
const TODAY = '2026-11-09';

function run(repository: InMemoryAchievementRepository, today = TODAY) {
  return new GetAchievementsUseCase(repository).execute({ userId: 'user-1', today }, NOW);
}

function level(result: Awaited<ReturnType<typeof run>>, id: string) {
  return result.achievements.find((item) => item.id === id);
}

describe('GetAchievementsUseCase', () => {
  it('turns entries into levels against each tier list', async () => {
    const entries = [
      ...entriesEndingAt(TODAY, 11, { hasPhoto: true }),
      ...entriesEndingAt('2026-10-20', 4, { mood: 'SAD', isFavorite: true }),
    ];
    const repository = new InMemoryAchievementRepository(entries, [], 1);

    const result = await run(repository);

    expect(level(result, 'pages')).toMatchObject({
      level: 2,
      value: 15,
      tiers: [1, 10, 30, 100, 200, 365],
    });
    expect(level(result, 'streak')).toMatchObject({ level: 2, value: 11 });
    expect(level(result, 'photos')).toMatchObject({ level: 2, value: 11 });
    expect(level(result, 'favorites')).toMatchObject({ level: 1, value: 4 });
    expect(level(result, 'rainbow')).toMatchObject({ level: 0, value: 2 });
    expect(level(result, 'letters')).toMatchObject({ level: 1, value: 1 });
    expect(level(result, 'songs')).toMatchObject({ level: 0 });
    expect(result.stats).toEqual({ currentStreak: 11, longestStreak: 11, totalPages: 15 });
  });

  it('stores newly reached levels as not yet seen', async () => {
    const repository = new InMemoryAchievementRepository(entriesEndingAt(TODAY, 10));

    await run(repository);

    expect(repository.levels).toEqual(
      expect.arrayContaining([
        { achievementId: 'pages', level: 2, seenLevel: 0 },
        { achievementId: 'streak', level: 2, seenLevel: 0 },
      ]),
    );
  });

  it('never lowers a level after pages are deleted', async () => {
    const repository = new InMemoryAchievementRepository(entriesEndingAt(TODAY, 2), [
      { achievementId: 'pages', level: 3, seenLevel: 3 },
    ]);

    const result = await run(repository);

    expect(level(result, 'pages')).toMatchObject({ level: 3, seenLevel: 3, value: 2 });
    expect(repository.levels.find((row) => row.achievementId === 'pages')?.level).toBe(3);
  });

  it('keeps the seen level, so a higher level shows as new', async () => {
    const repository = new InMemoryAchievementRepository(entriesEndingAt(TODAY, 10), [
      { achievementId: 'pages', level: 1, seenLevel: 1 },
    ]);

    const result = await run(repository);

    expect(level(result, 'pages')).toMatchObject({ level: 2, seenLevel: 1 });
  });

  it('ignores entries dated after today for the streak', async () => {
    const repository = new InMemoryAchievementRepository([
      ...entriesEndingAt('2026-11-12', 3),
      ...entriesEndingAt(TODAY, 1),
    ]);

    const result = await run(repository);

    expect(result.stats).toMatchObject({ longestStreak: 1, totalPages: 4 });
  });

  it('counts each return after more than three days away as a comeback', async () => {
    const repository = new InMemoryAchievementRepository(
      ['2026-11-09', '2026-11-05', '2026-11-02', '2026-10-20'].flatMap((date) =>
        entriesEndingAt(date, 1),
      ),
    );

    const result = await run(repository);

    expect(level(result, 'comeback')).toMatchObject({ value: 2, level: 1 });
  });

  it('lists the current month, then only months that reached the goal, newest first', async () => {
    const repository = new InMemoryAchievementRepository([
      ...entriesEndingAt(TODAY, 4),
      ...entriesEndingAt('2026-10-31', 12),
      ...entriesEndingAt('2026-09-30', 3),
    ]);

    const result = await run(repository);

    expect(result.monthly).toEqual([
      { month: '2026-11', pages: 4, goal: 10, earned: false },
      { month: '2026-10', pages: 12, goal: 10, earned: true },
    ]);
  });

  it("rejects a date that cannot be the user's local today", async () => {
    await expect(run(new InMemoryAchievementRepository(), '2026-11-20')).rejects.toBeInstanceOf(
      LocalDateOutOfRangeError,
    );
  });
});
