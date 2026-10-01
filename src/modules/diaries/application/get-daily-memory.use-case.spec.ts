import { GetDailyMemoryUseCase } from './get-daily-memory.use-case';
import { DiaryEntryEntity, DiaryEntryRepository, MoodCount } from '../domain/diary-entry.repository';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { LocalDateOutOfRangeError } from '../domain/local-date-out-of-range.error';

function buildEntry(id: string, entryDate: string, userId = 'user-1'): DiaryEntryEntity {
  return {
    id,
    userId,
    mood: 'HAPPY',
    note: null,
    photoUrls: [],
    songExternalId: null,
    songTitle: null,
    songArtist: null,
    songArtworkUrl: null,
    songPreviewUrl: null,
    isFavorite: false,
    deletedAt: null,
    entryDate: new Date(`${entryDate}T00:00:00.000Z`),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function noonUtc(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function buildOldEntries(count: number): DiaryEntryEntity[] {
  return Array.from({ length: count }, (_, i) =>
    buildEntry(`old-${i}`, `2025-01-${String(1 + i).padStart(2, '0')}`),
  );
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(private readonly entries: DiaryEntryEntity[]) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in memory tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in memory tests');
  }

  findByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null> {
    const entry = this.entries.find(
      (candidate) =>
        candidate.userId === userId && candidate.entryDate.getTime() === entryDate.getTime(),
    );
    return Promise.resolve(entry ?? null);
  }

  countByUserOnOrBefore(userId: string, date: Date): Promise<number> {
    return Promise.resolve(this.onOrBefore(userId, date).length);
  }

  findByUserOnOrBeforeAt(
    userId: string,
    date: Date,
    offset: number,
  ): Promise<DiaryEntryEntity | null> {
    return Promise.resolve(this.onOrBefore(userId, date)[offset] ?? null);
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in memory tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in memory tests');
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in memory tests');
  }

  findDeletedByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in memory tests');
  }

  softDelete(): Promise<boolean> {
    throw new Error('not used in memory tests');
  }

  findDeletedBefore(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in memory tests');
  }

  purge(): Promise<boolean> {
    throw new Error('not used in memory tests');
  }

  countMoodsInRange(): Promise<MoodCount[]> {
    throw new Error('not used in memory tests');
  }


  private onOrBefore(userId: string, date: Date): DiaryEntryEntity[] {
    return this.entries
      .filter((entry) => entry.userId === userId && entry.entryDate <= date)
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  }
}

function setup(entries: DiaryEntryEntity[]): GetDailyMemoryUseCase {
  return new GetDailyMemoryUseCase(new InMemoryDiaryEntryRepository(entries));
}

describe('GetDailyMemoryUseCase', () => {
  it('prefers the entry from the same day last year', async () => {
    const useCase = setup([
      buildEntry('last-year', '2025-09-28'),
      buildEntry('last-month', '2026-08-28'),
      buildEntry('old', '2026-01-10'),
    ]);

    const memory = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );

    expect(memory?.entry.id).toBe('last-year');
    expect(memory?.relativeLabel).toBe('1 year ago');
  });

  it('falls back to the same day last month', async () => {
    const useCase = setup([
      buildEntry('last-month', '2026-08-28'),
      buildEntry('old', '2026-01-10'),
    ]);

    const memory = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );

    expect(memory?.entry.id).toBe('last-month');
    expect(memory?.relativeLabel).toBe('1 month ago');
  });

  it('treats the month before January as December of the previous year', async () => {
    const useCase = setup([buildEntry('december', '2025-12-15')]);

    const memory = await useCase.execute(
      { userId: 'user-1', today: '2026-01-15' },
      noonUtc('2026-01-15'),
    );

    expect(memory?.entry.id).toBe('december');
  });

  it('falls back to an entry at least 30 days old', async () => {
    const useCase = setup([buildEntry('old', '2026-06-10'), buildEntry('recent', '2026-09-01')]);

    const memory = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );

    expect(memory?.entry.id).toBe('old');
    expect(memory?.relativeLabel).toBe('3 months ago');
  });

  it('counts an entry exactly 30 days old as old enough', async () => {
    const useCase = setup([buildEntry('thirty-days', '2026-08-29')]);

    const memory = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );

    expect(memory?.entry.id).toBe('thirty-days');
    expect(memory?.relativeLabel).toBe('30 days ago');
  });

  it('returns null when the user has no entry old enough', async () => {
    const useCase = setup([buildEntry('recent', '2026-09-20'), buildEntry('today', '2026-09-28')]);

    await expect(
      useCase.execute({ userId: 'user-1', today: '2026-09-28' }, noonUtc('2026-09-28')),
    ).resolves.toBeNull();
  });

  it('never returns an entry of another user', async () => {
    const useCase = setup([
      buildEntry('other-last-year', '2025-09-28', 'user-2'),
      buildEntry('other-old', '2026-01-01', 'user-2'),
    ]);

    await expect(
      useCase.execute({ userId: 'user-1', today: '2026-09-28' }, noonUtc('2026-09-28')),
    ).resolves.toBeNull();
  });

  it('returns the same memory for repeated calls on the same day', async () => {
    const useCase = setup(buildOldEntries(20));

    const first = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );
    const second = await useCase.execute(
      { userId: 'user-1', today: '2026-09-28' },
      noonUtc('2026-09-28'),
    );

    expect(first).not.toBeNull();
    expect(second?.entry.id).toBe(first?.entry.id);
  });

  it('can pick a different fallback memory on a different day', async () => {
    const useCase = setup(buildOldEntries(20));
    const days = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ];

    const picked = new Set<string | undefined>();
    for (const today of days) {
      const memory = await useCase.execute({ userId: 'user-1', today }, noonUtc(today));
      picked.add(memory?.entry.id);
    }

    expect(picked.size).toBeGreaterThan(1);
  });

  it('rejects an impossible calendar date', async () => {
    const useCase = setup([]);

    await expect(
      useCase.execute({ userId: 'user-1', today: '2026-02-30' }, noonUtc('2026-02-28')),
    ).rejects.toBeInstanceOf(InvalidEntryDateError);
  });

  it.each([
    ['yesterday in UTC (user west of UTC)', '2026-09-27'],
    ['tomorrow in UTC (user east of UTC)', '2026-09-29'],
  ])('accepts %s', async (_label, today) => {
    const useCase = setup([]);

    await expect(
      useCase.execute({ userId: 'user-1', today }, noonUtc('2026-09-28')),
    ).resolves.toBeNull();
  });

  it.each(['2026-10-28', '2026-09-26', '0100-01-15'])(
    'rejects %s as it cannot be the local today of any user',
    async (today) => {
      const useCase = setup([buildEntry('today', '2026-09-28')]);

      await expect(
        useCase.execute({ userId: 'user-1', today }, noonUtc('2026-09-28')),
      ).rejects.toBeInstanceOf(LocalDateOutOfRangeError);
    },
  );
});
