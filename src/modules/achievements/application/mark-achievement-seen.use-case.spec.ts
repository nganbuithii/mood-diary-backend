import { AchievementNotFoundError } from '../domain/achievement-not-found.error';
import { MarkAchievementSeenUseCase } from './mark-achievement-seen.use-case';
import { InMemoryAchievementRepository } from './testing/in-memory-achievement.repository';

describe('MarkAchievementSeenUseCase', () => {
  it('marks the current level as seen', async () => {
    const repository = new InMemoryAchievementRepository(undefined, [
      { achievementId: 'pages', level: 2, seenLevel: 1 },
    ]);

    await new MarkAchievementSeenUseCase(repository).execute('user-1', 'pages');

    expect(repository.levels).toEqual([{ achievementId: 'pages', level: 2, seenLevel: 2 }]);
  });

  it('is a no-op for an achievement with no level yet', async () => {
    const repository = new InMemoryAchievementRepository();

    await expect(
      new MarkAchievementSeenUseCase(repository).execute('user-1', 'songs'),
    ).resolves.toBeUndefined();
    expect(repository.levels).toEqual([]);
  });

  it('rejects an unknown achievement', async () => {
    await expect(
      new MarkAchievementSeenUseCase(new InMemoryAchievementRepository()).execute(
        'user-1',
        'toString',
      ),
    ).rejects.toBeInstanceOf(AchievementNotFoundError);
  });
});
