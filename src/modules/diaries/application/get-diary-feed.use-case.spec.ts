import { GetDiaryFeedUseCase } from './get-diary-feed.use-case';
import {
  DiaryEntryEntity,
  DiaryEntryRepository,
  DiaryFeedPageQuery,
  DiaryMood,
  MoodCount,
} from '../domain/diary-entry.repository';
import { InvalidFeedCursorError } from '../domain/invalid-feed-cursor.error';

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function buildEntry(date: string, mood: DiaryMood = 'HAPPY', userId = 'user-1'): DiaryEntryEntity {
  return {
    id: `${userId}-${date}`,
    userId,
    mood,
    note: null,
    photoUrls: [],
    songExternalId: null,
    songTitle: null,
    songArtist: null,
    songArtworkUrl: null,
    songPreviewUrl: null,
    isFavorite: false,
    deletedAt: null,
    entryDate: toDate(date),
    createdAt: toDate(date),
    updatedAt: toDate(date),
  };
}

// Consecutive days going back from `start`, e.g. daysBack('2026-09-29', 3) → 09-29, 09-28, 09-27.
function daysBack(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    new Date(toDate(start).getTime() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(public entries: DiaryEntryEntity[]) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in feed tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in feed tests');
  }

  findByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in feed tests');
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in feed tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in feed tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in feed tests');
  }

  findPageNewestFirst(query: DiaryFeedPageQuery): Promise<DiaryEntryEntity[]> {
    return Promise.resolve(
      this.entries
        .filter(
          (entry) =>
            entry.userId === query.userId &&
            (!query.mood || entry.mood === query.mood) &&
            (!query.favorite || entry.isFavorite) &&
            (!query.from || entry.entryDate >= query.from) &&
            (!query.to || entry.entryDate < query.to) &&
            (!query.before || entry.entryDate < query.before),
        )
        .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
        .slice(0, query.take),
    );
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in feed tests');
  }

  findDeletedByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in feed tests');
  }

  softDelete(): Promise<boolean> {
    throw new Error('not used in feed tests');
  }

  findDeletedBefore(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in feed tests');
  }

  purge(): Promise<boolean> {
    throw new Error('not used in feed tests');
  }

  countMoodsInRange(): Promise<MoodCount[]> {
    throw new Error('not used in feed tests');
  }
}

function favorite(entry: DiaryEntryEntity): DiaryEntryEntity {
  return { ...entry, isFavorite: true };
}

function setup(entries: DiaryEntryEntity[]) {
  const repository = new InMemoryDiaryEntryRepository(entries);
  return { repository, useCase: new GetDiaryFeedUseCase(repository) };
}

function datesOf(entries: DiaryEntryEntity[]): string[] {
  return entries.map((entry) => entry.entryDate.toISOString().slice(0, 10));
}

function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

describe('GetDiaryFeedUseCase', () => {
  it('returns an empty page when the user has no entries', async () => {
    const { useCase } = setup([]);

    await expect(useCase.execute({ userId: 'user-1', limit: 12 })).resolves.toEqual({
      entries: [],
      nextCursor: null,
    });
  });

  it('pages through every entry newest first without duplicates or gaps', async () => {
    const dates = daysBack('2026-09-29', 25);
    const { useCase } = setup(dates.map((date) => buildEntry(date)));

    const first = await useCase.execute({ userId: 'user-1', limit: 12 });
    const second = await useCase.execute({ userId: 'user-1', limit: 12, cursor: first.nextCursor! });
    const third = await useCase.execute({ userId: 'user-1', limit: 12, cursor: second.nextCursor! });

    expect([first.entries.length, second.entries.length, third.entries.length]).toEqual([12, 12, 1]);
    expect(third.nextCursor).toBeNull();
    expect(datesOf([...first.entries, ...second.entries, ...third.entries])).toEqual(dates);
  });

  it('returns no cursor when the entries fill exactly one page', async () => {
    const { useCase } = setup(daysBack('2026-09-29', 12).map((date) => buildEntry(date)));

    const page = await useCase.execute({ userId: 'user-1', limit: 12 });

    expect(page.entries).toHaveLength(12);
    expect(page.nextCursor).toBeNull();
  });

  it('orders newest first across month and year boundaries', async () => {
    const { useCase } = setup(
      ['2025-12-31', '2026-02-01', '2026-01-31', '2026-01-01'].map((date) => buildEntry(date)),
    );

    const page = await useCase.execute({ userId: 'user-1', limit: 12 });

    expect(datesOf(page.entries)).toEqual(['2026-02-01', '2026-01-31', '2026-01-01', '2025-12-31']);
  });

  it('filters by mood, by month, and by both', async () => {
    const { useCase } = setup([
      buildEntry('2026-09-20', 'HAPPY'),
      buildEntry('2026-09-10', 'SAD'),
      buildEntry('2026-08-20', 'HAPPY'),
      buildEntry('2026-08-10', 'SAD'),
    ]);

    const byMood = await useCase.execute({ userId: 'user-1', limit: 12, mood: 'HAPPY' });
    const byMonth = await useCase.execute({ userId: 'user-1', limit: 12, month: '2026-08' });
    const byBoth = await useCase.execute({ userId: 'user-1', limit: 12, mood: 'SAD', month: '2026-09' });

    expect(datesOf(byMood.entries)).toEqual(['2026-09-20', '2026-08-20']);
    expect(datesOf(byMonth.entries)).toEqual(['2026-08-20', '2026-08-10']);
    expect(datesOf(byBoth.entries)).toEqual(['2026-09-10']);
  });

  it('keeps the month filter when paging', async () => {
    const { useCase } = setup([
      ...daysBack('2026-09-05', 5).map((date) => buildEntry(date)),
      buildEntry('2026-08-31'),
    ]);

    const first = await useCase.execute({ userId: 'user-1', limit: 3, month: '2026-09' });
    const second = await useCase.execute({
      userId: 'user-1',
      limit: 3,
      month: '2026-09',
      cursor: first.nextCursor!,
    });

    expect(datesOf(first.entries)).toEqual(['2026-09-05', '2026-09-04', '2026-09-03']);
    expect(datesOf(second.entries)).toEqual(['2026-09-02', '2026-09-01']);
    expect(second.nextCursor).toBeNull();
  });

  it('does not include the first day of the next month', async () => {
    const { useCase } = setup([buildEntry('2026-03-01'), buildEntry('2026-02-28')]);

    const page = await useCase.execute({ userId: 'user-1', limit: 12, month: '2026-02' });

    expect(datesOf(page.entries)).toEqual(['2026-02-28']);
  });

  it('does not repeat entries when a newer entry is written between page loads', async () => {
    const { repository, useCase } = setup(daysBack('2026-09-28', 4).map((date) => buildEntry(date)));

    const first = await useCase.execute({ userId: 'user-1', limit: 2 });
    repository.entries.push(buildEntry('2026-09-29'));
    const second = await useCase.execute({ userId: 'user-1', limit: 2, cursor: first.nextCursor! });

    expect(datesOf(first.entries)).toEqual(['2026-09-28', '2026-09-27']);
    expect(datesOf(second.entries)).toEqual(['2026-09-26', '2026-09-25']);
  });

  it("never returns another user's entries, even with a cursor from their feed", async () => {
    const { useCase } = setup([
      buildEntry('2026-09-20', 'HAPPY', 'user-1'),
      ...daysBack('2026-09-29', 3).map((date) => buildEntry(date, 'SAD', 'user-2')),
    ]);

    const otherUserPage = await useCase.execute({ userId: 'user-2', limit: 1 });
    const page = await useCase.execute({ userId: 'user-1', limit: 12, cursor: otherUserPage.nextCursor! });

    expect(page.entries.every((entry) => entry.userId === 'user-1')).toBe(true);
    expect(datesOf(page.entries)).toEqual(['2026-09-20']);
  });

  it.each([
    ['not base64 JSON', 'not-a-cursor'],
    ['JSON without a date', encodeCursor({ x: 1 })],
    ['a non-string date', encodeCursor({ d: 20260929 })],
    ['an impossible date', encodeCursor({ d: '2026-02-30' })],
  ])('rejects a cursor that is %s', async (_label, cursor) => {
    const { useCase } = setup([buildEntry('2026-09-29')]);

    await expect(useCase.execute({ userId: 'user-1', limit: 12, cursor })).rejects.toBeInstanceOf(
      InvalidFeedCursorError,
    );
  });

  it('rejects a cursor used with different filters than the page it came from', async () => {
    const { useCase } = setup(daysBack('2026-09-29', 3).map((date) => buildEntry(date)));
    const { nextCursor } = await useCase.execute({ userId: 'user-1', limit: 1, mood: 'HAPPY', month: '2026-09' });

    for (const filters of [{}, { mood: 'SAD' as const, month: '2026-09' }, { mood: 'HAPPY' as const, month: '2026-08' }]) {
      await expect(
        useCase.execute({ userId: 'user-1', limit: 1, cursor: nextCursor!, ...filters }),
      ).rejects.toBeInstanceOf(InvalidFeedCursorError);
    }
  });

  it('returns only favorites when favorite is true, alone or with other filters', async () => {
    const { useCase } = setup([
      favorite(buildEntry('2026-09-20', 'HAPPY')),
      buildEntry('2026-09-15', 'HAPPY'),
      favorite(buildEntry('2026-09-10', 'SAD')),
      favorite(buildEntry('2026-08-20', 'HAPPY')),
    ]);

    const all = await useCase.execute({ userId: 'user-1', limit: 12, favorite: true });
    const happy = await useCase.execute({ userId: 'user-1', limit: 12, favorite: true, mood: 'HAPPY' });
    const september = await useCase.execute({ userId: 'user-1', limit: 12, favorite: true, month: '2026-09' });

    expect(datesOf(all.entries)).toEqual(['2026-09-20', '2026-09-10', '2026-08-20']);
    expect(datesOf(happy.entries)).toEqual(['2026-09-20', '2026-08-20']);
    expect(datesOf(september.entries)).toEqual(['2026-09-20', '2026-09-10']);
  });

  it('treats favorite: false the same as no favorite filter', async () => {
    const { useCase } = setup([favorite(buildEntry('2026-09-20')), buildEntry('2026-09-19'), buildEntry('2026-09-18')]);

    const first = await useCase.execute({ userId: 'user-1', limit: 2, favorite: false });
    const second = await useCase.execute({ userId: 'user-1', limit: 2, cursor: first.nextCursor! });

    expect(datesOf(first.entries)).toEqual(['2026-09-20', '2026-09-19']);
    expect(datesOf(second.entries)).toEqual(['2026-09-18']);
  });

  it('keeps the favorite filter when paging', async () => {
    const { useCase } = setup(
      daysBack('2026-09-29', 6).map((date, index) => (index % 2 === 0 ? favorite(buildEntry(date)) : buildEntry(date))),
    );

    const first = await useCase.execute({ userId: 'user-1', limit: 2, favorite: true });
    const second = await useCase.execute({ userId: 'user-1', limit: 2, favorite: true, cursor: first.nextCursor! });

    expect(datesOf(first.entries)).toEqual(['2026-09-29', '2026-09-27']);
    expect(datesOf(second.entries)).toEqual(['2026-09-25']);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects a cursor moved between the favorites feed and the full feed', async () => {
    const { useCase } = setup(daysBack('2026-09-29', 3).map((date) => favorite(buildEntry(date))));
    const favoritesPage = await useCase.execute({ userId: 'user-1', limit: 1, favorite: true });
    const fullPage = await useCase.execute({ userId: 'user-1', limit: 1 });

    await expect(
      useCase.execute({ userId: 'user-1', limit: 1, cursor: favoritesPage.nextCursor! }),
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
    await expect(
      useCase.execute({ userId: 'user-1', limit: 1, favorite: true, cursor: fullPage.nextCursor! }),
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it('rejects a limit below 1', async () => {
    const { useCase } = setup([buildEntry('2026-09-29')]);

    await expect(useCase.execute({ userId: 'user-1', limit: 0 })).rejects.toBeInstanceOf(RangeError);
  });
});
