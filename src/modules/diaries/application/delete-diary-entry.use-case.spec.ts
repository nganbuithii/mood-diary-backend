import { DeleteDiaryEntryUseCase } from './delete-diary-entry.use-case';
import { DiaryEntryEntity, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DiaryEntryNotFoundError } from '../domain/diary-entry-not-found.error';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function buildEntry(date: string, userId = 'user-1', deletedAt: Date | null = null): DiaryEntryEntity {
  return {
    id: `${userId}-${date}`,
    userId,
    mood: 'HAPPY',
    note: 'A good day',
    photoUrls: ['https://cdn.test/photo.jpg'],
    songExternalId: null,
    songTitle: null,
    songArtist: null,
    songArtworkUrl: null,
    songPreviewUrl: null,
    isFavorite: true,
    deletedAt,
    entryDate: toDate(date),
    createdAt: toDate(date),
    updatedAt: toDate(date),
  };
}

// Mirrors the soft-delete semantics of PrismaDiaryEntryRepository: deleted rows stay in
// `entries`, and only findDeletedByUserAndDate can see them.
class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(public entries: DiaryEntryEntity[]) {}

  private indexOf(userId: string, entryDate: Date, deleted: boolean): number {
    return this.entries.findIndex(
      (entry) =>
        entry.userId === userId &&
        entry.entryDate.getTime() === entryDate.getTime() &&
        (entry.deletedAt !== null) === deleted,
    );
  }

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in delete tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in delete tests');
  }

  findByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null> {
    return Promise.resolve(this.entries[this.indexOf(userId, entryDate, false)] ?? null);
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in delete tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in delete tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in delete tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in delete tests');
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in delete tests');
  }

  findDeletedByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null> {
    return Promise.resolve(this.entries[this.indexOf(userId, entryDate, true)] ?? null);
  }

  softDelete(userId: string, entryDate: Date, deletedAt: Date): Promise<boolean> {
    const index = this.indexOf(userId, entryDate, false);
    if (index === -1) return Promise.resolve(false);
    this.entries[index] = { ...this.entries[index], deletedAt };
    return Promise.resolve(true);
  }
}

const NOW = new Date('2026-10-01T08:00:00.000Z');

function setup(entries: DiaryEntryEntity[]) {
  const repository = new InMemoryDiaryEntryRepository(entries);
  return {
    repository,
    deleteEntry: new DeleteDiaryEntryUseCase(repository),
  };
}

describe('DeleteDiaryEntryUseCase', () => {
  it('soft-deletes the entry: it disappears from reads but the row is kept', async () => {
    const { repository, deleteEntry } = setup([buildEntry('2026-09-20')]);

    await deleteEntry.execute({ userId: 'user-1', date: '2026-09-20' }, NOW);

    await expect(repository.findByUserAndDate('user-1', toDate('2026-09-20'))).resolves.toBeNull();
    expect(repository.entries).toHaveLength(1);
    expect(repository.entries[0].deletedAt).toEqual(NOW);
  });

  it('throws DiaryEntryNotFoundError when there is no entry on that date', async () => {
    const { deleteEntry } = setup([buildEntry('2026-09-20')]);

    await expect(deleteEntry.execute({ userId: 'user-1', date: '2026-09-21' }, NOW)).rejects.toBeInstanceOf(
      DiaryEntryNotFoundError,
    );
  });

  it('throws DiaryEntryNotFoundError when the entry is already deleted, keeping the first deletedAt', async () => {
    const firstDeletedAt = new Date('2026-09-30T08:00:00.000Z');
    const { repository, deleteEntry } = setup([buildEntry('2026-09-20', 'user-1', firstDeletedAt)]);

    await expect(deleteEntry.execute({ userId: 'user-1', date: '2026-09-20' }, NOW)).rejects.toBeInstanceOf(
      DiaryEntryNotFoundError,
    );
    expect(repository.entries[0].deletedAt).toEqual(firstDeletedAt);
  });

  it("cannot delete another user's entry", async () => {
    const { repository, deleteEntry } = setup([buildEntry('2026-09-20', 'user-2')]);

    await expect(deleteEntry.execute({ userId: 'user-1', date: '2026-09-20' }, NOW)).rejects.toBeInstanceOf(
      DiaryEntryNotFoundError,
    );
    expect(repository.entries[0].deletedAt).toBeNull();
  });

  it.each(['2026-02-30', '2026-9-20', 'not-a-date'])('rejects the invalid date %s', async (date) => {
    const { deleteEntry } = setup([buildEntry('2026-09-20')]);

    await expect(deleteEntry.execute({ userId: 'user-1', date }, NOW)).rejects.toBeInstanceOf(InvalidEntryDateError);
  });
});
