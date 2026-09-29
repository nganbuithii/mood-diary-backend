import { GetStreakUseCase } from './get-streak.use-case';
import { DiaryEntryEntity, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { LocalDateOutOfRangeError } from '../domain/local-date-out-of-range.error';

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function noonUtc(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(private readonly entries: Array<{ userId: string; entryDate: Date }>) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in streak tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in streak tests');
  }

  findByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in streak tests');
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in streak tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in streak tests');
  }

  findEntryDatesOnOrBefore(userId: string, date: Date): Promise<Date[]> {
    return Promise.resolve(
      this.entries
        .filter((entry) => entry.userId === userId && entry.entryDate <= date)
        .map((entry) => entry.entryDate)
        .sort((a, b) => b.getTime() - a.getTime()),
    );
  }
}

function setup(dates: string[], userId = 'user-1'): GetStreakUseCase {
  return new GetStreakUseCase(
    new InMemoryDiaryEntryRepository(dates.map((date) => ({ userId, entryDate: toDate(date) }))),
  );
}

function streakOn(useCase: GetStreakUseCase, today: string) {
  return useCase.execute({ userId: 'user-1', today }, noonUtc(today));
}

describe('GetStreakUseCase', () => {
  it('returns zeros when the user has no entries', async () => {
    await expect(streakOn(setup([]), '2026-09-29')).resolves.toEqual({
      current: 0,
      longest: 0,
      writtenToday: false,
    });
  });

  it('counts consecutive days ending today', async () => {
    const useCase = setup(['2026-09-27', '2026-09-28', '2026-09-29']);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toEqual({
      current: 3,
      longest: 3,
      writtenToday: true,
    });
  });

  it('keeps the streak alive when the user wrote yesterday but not yet today', async () => {
    const useCase = setup(['2026-09-27', '2026-09-28']);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toEqual({
      current: 2,
      longest: 2,
      writtenToday: false,
    });
  });

  it('resets the current streak once a whole day is missed but keeps the longest', async () => {
    const useCase = setup(['2026-09-26', '2026-09-27']);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toEqual({
      current: 0,
      longest: 2,
      writtenToday: false,
    });
  });

  it('reports the longest run even when it is not the most recent one', async () => {
    const useCase = setup([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-10',
      '2026-09-28',
      '2026-09-29',
    ]);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toMatchObject({ current: 2, longest: 4 });
  });

  it('counts a backfilled day, joining the runs around it', async () => {
    const useCase = setup(['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toMatchObject({ current: 4, longest: 4 });
  });

  it('ignores entries dated after today', async () => {
    const useCase = setup(['2026-09-29', '2026-09-30', '2026-10-01']);

    await expect(streakOn(useCase, '2026-09-29')).resolves.toEqual({
      current: 1,
      longest: 1,
      writtenToday: true,
    });
  });

  it('continues across month, year and leap-day boundaries', async () => {
    await expect(
      streakOn(setup(['2026-12-30', '2026-12-31', '2027-01-01']), '2027-01-01'),
    ).resolves.toMatchObject({ current: 3 });
    await expect(
      streakOn(setup(['2028-02-28', '2028-02-29', '2028-03-01']), '2028-03-01'),
    ).resolves.toMatchObject({ current: 3 });
  });

  it("does not count other users' entries", async () => {
    const useCase = new GetStreakUseCase(
      new InMemoryDiaryEntryRepository([
        { userId: 'user-2', entryDate: toDate('2026-09-28') },
        { userId: 'user-1', entryDate: toDate('2026-09-29') },
      ]),
    );

    await expect(streakOn(useCase, '2026-09-29')).resolves.toMatchObject({ current: 1, longest: 1 });
  });

  it('rejects an invalid calendar date', async () => {
    await expect(
      setup([]).execute({ userId: 'user-1', today: '2026-02-30' }, noonUtc('2026-02-28')),
    ).rejects.toBeInstanceOf(InvalidEntryDateError);
  });

  it('rejects a date that cannot be the local today of any user', async () => {
    await expect(
      setup([]).execute({ userId: 'user-1', today: '2026-09-25' }, noonUtc('2026-09-29')),
    ).rejects.toBeInstanceOf(LocalDateOutOfRangeError);
  });
});
