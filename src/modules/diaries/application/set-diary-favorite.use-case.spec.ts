import { SetDiaryFavoriteUseCase } from './set-diary-favorite.use-case';
import { DiaryEntryEntity, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DiaryEntryNotFoundError } from '../domain/diary-entry-not-found.error';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function buildEntry(date: string, userId = 'user-1', isFavorite = false): DiaryEntryEntity {
  return {
    id: `${userId}-${date}`,
    userId,
    mood: 'HAPPY',
    note: null,
    photoUrls: [],
    songExternalId: null,
    songTitle: null,
    songArtist: null,
    songArtworkUrl: null,
    songPreviewUrl: null,
    isFavorite,
    entryDate: toDate(date),
    createdAt: toDate(date),
    updatedAt: toDate(date),
  };
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(public entries: DiaryEntryEntity[]) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in favorite tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in favorite tests');
  }

  findByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in favorite tests');
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in favorite tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in favorite tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in favorite tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in favorite tests');
  }

  setFavorite(userId: string, entryDate: Date, isFavorite: boolean): Promise<DiaryEntryEntity | null> {
    const index = this.entries.findIndex(
      (entry) => entry.userId === userId && entry.entryDate.getTime() === entryDate.getTime(),
    );
    if (index === -1) return Promise.resolve(null);
    this.entries[index] = { ...this.entries[index], isFavorite };
    return Promise.resolve(this.entries[index]);
  }
}

function setup(entries: DiaryEntryEntity[]) {
  const repository = new InMemoryDiaryEntryRepository(entries);
  return { repository, useCase: new SetDiaryFavoriteUseCase(repository) };
}

describe('SetDiaryFavoriteUseCase', () => {
  it('adds an entry to favorites and returns it', async () => {
    const { useCase } = setup([buildEntry('2026-09-20')]);

    const entry = await useCase.execute({ userId: 'user-1', date: '2026-09-20', isFavorite: true });

    expect(entry.isFavorite).toBe(true);
    expect(entry.entryDate).toEqual(toDate('2026-09-20'));
  });

  it('removes an entry from favorites', async () => {
    const { useCase } = setup([buildEntry('2026-09-20', 'user-1', true)]);

    const entry = await useCase.execute({ userId: 'user-1', date: '2026-09-20', isFavorite: false });

    expect(entry.isFavorite).toBe(false);
  });

  it('is idempotent: sending the same value twice keeps it', async () => {
    const { useCase } = setup([buildEntry('2026-09-20')]);

    await useCase.execute({ userId: 'user-1', date: '2026-09-20', isFavorite: true });
    const entry = await useCase.execute({ userId: 'user-1', date: '2026-09-20', isFavorite: true });

    expect(entry.isFavorite).toBe(true);
  });

  it('throws DiaryEntryNotFoundError when there is no entry on that date', async () => {
    const { useCase } = setup([buildEntry('2026-09-20')]);

    await expect(
      useCase.execute({ userId: 'user-1', date: '2026-09-21', isFavorite: true }),
    ).rejects.toBeInstanceOf(DiaryEntryNotFoundError);
  });

  it("cannot favorite another user's entry", async () => {
    const { repository, useCase } = setup([buildEntry('2026-09-20', 'user-2')]);

    await expect(
      useCase.execute({ userId: 'user-1', date: '2026-09-20', isFavorite: true }),
    ).rejects.toBeInstanceOf(DiaryEntryNotFoundError);
    expect(repository.entries[0].isFavorite).toBe(false);
  });

  it.each(['2026-02-30', '2026-9-20', 'not-a-date'])('rejects the invalid date %s', async (date) => {
    const { useCase } = setup([buildEntry('2026-09-20')]);

    await expect(useCase.execute({ userId: 'user-1', date, isFavorite: true })).rejects.toBeInstanceOf(
      InvalidEntryDateError,
    );
  });
});
