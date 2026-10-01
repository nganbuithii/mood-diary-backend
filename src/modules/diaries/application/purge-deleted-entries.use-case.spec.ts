import { DELETED_ENTRY_RETENTION_DAYS, PurgeDeletedEntriesUseCase } from './purge-deleted-entries.use-case';
import { DiaryEntryEntity, DiaryEntryRepository, MoodCount } from '../domain/diary-entry.repository';
import { DiaryPhotoStorage, DiaryPhotoUploadResult } from '../domain/diary-photo-storage';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T03:00:00.000Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function buildEntry(id: string, deletedAt: Date | null, photoUrls: string[] = []): DiaryEntryEntity {
  return {
    id,
    userId: 'user-1',
    mood: 'HAPPY',
    note: null,
    photoUrls,
    songExternalId: null,
    songTitle: null,
    songArtist: null,
    songArtworkUrl: null,
    songPreviewUrl: null,
    isFavorite: false,
    deletedAt,
    entryDate: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

class InMemoryDiaryEntryRepository implements DiaryEntryRepository {
  constructor(public entries: DiaryEntryEntity[]) {}

  upsert(): Promise<DiaryEntryEntity> {
    throw new Error('not used in purge tests');
  }

  findManyByUserInRange(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in purge tests');
  }

  findByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in purge tests');
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in purge tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in purge tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in purge tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in purge tests');
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in purge tests');
  }

  findDeletedByUserAndDate(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in purge tests');
  }

  softDelete(): Promise<boolean> {
    throw new Error('not used in purge tests');
  }

  findDeletedBefore(cutoff: Date, take: number, afterId?: string): Promise<DiaryEntryEntity[]> {
    return Promise.resolve(
      this.entries
        .filter((entry) => entry.deletedAt !== null && entry.deletedAt < cutoff && (!afterId || entry.id > afterId))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, take),
    );
  }

  purge(id: string, cutoff: Date): Promise<boolean> {
    const index = this.entries.findIndex(
      (entry) => entry.id === id && entry.deletedAt !== null && entry.deletedAt < cutoff,
    );
    if (index === -1) return Promise.resolve(false);
    this.entries.splice(index, 1);
    return Promise.resolve(true);
  }

  countMoodsInRange(): Promise<MoodCount[]> {
    throw new Error('not used in purge tests');
  }
}

class FakeDiaryPhotoStorage implements DiaryPhotoStorage {
  public deletedUrls: string[] = [];
  public failingUrls = new Set<string>();

  upload(): Promise<DiaryPhotoUploadResult> {
    throw new Error('not used in purge tests');
  }

  delete(url: string): Promise<void> {
    if (this.failingUrls.has(url)) return Promise.reject(new Error('storage down'));
    this.deletedUrls.push(url);
    return Promise.resolve();
  }
}

function setup(entries: DiaryEntryEntity[]) {
  const repository = new InMemoryDiaryEntryRepository(entries);
  const storage = new FakeDiaryPhotoStorage();
  return { repository, storage, useCase: new PurgeDeletedEntriesUseCase(repository, storage) };
}

function idsOf(entries: DiaryEntryEntity[]): string[] {
  return entries.map((entry) => entry.id);
}

describe('PurgeDeletedEntriesUseCase', () => {
  it('purges entries deleted longer ago than the retention period, together with their photos', async () => {
    const { repository, storage, useCase } = setup([
      buildEntry('old', daysAgo(DELETED_ENTRY_RETENTION_DAYS + 1), ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']),
    ]);

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 1, failed: 0 });
    expect(repository.entries).toEqual([]);
    expect(storage.deletedUrls).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);
  });

  it('keeps live entries and entries deleted within the retention period', async () => {
    const { repository, storage, useCase } = setup([
      buildEntry('live', null, ['https://cdn.test/live.jpg']),
      buildEntry('recent', daysAgo(DELETED_ENTRY_RETENTION_DAYS - 1), ['https://cdn.test/recent.jpg']),
      buildEntry('exactly-at-cutoff', daysAgo(DELETED_ENTRY_RETENTION_DAYS)),
    ]);

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 0, failed: 0 });
    expect(idsOf(repository.entries)).toEqual(['live', 'recent', 'exactly-at-cutoff']);
    expect(storage.deletedUrls).toEqual([]);
  });

  it('keeps an entry whose photos fail to delete so the next run retries it', async () => {
    const { repository, storage, useCase } = setup([
      buildEntry('broken', daysAgo(40), ['https://cdn.test/fails.jpg', 'https://cdn.test/ok.jpg']),
      buildEntry('fine', daysAgo(40), ['https://cdn.test/fine.jpg']),
    ]);
    storage.failingUrls.add('https://cdn.test/fails.jpg');

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 1, failed: 1 });
    expect(idsOf(repository.entries)).toEqual(['broken']);

    storage.failingUrls.clear();
    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 1, failed: 0 });
    expect(repository.entries).toEqual([]);
  });

  it('works through more entries than fit in one batch', async () => {
    const ids = Array.from({ length: 120 }, (_, index) => `entry-${String(index).padStart(3, '0')}`);
    const { repository, useCase } = setup(ids.map((id) => buildEntry(id, daysAgo(31))));

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 120, failed: 0 });
    expect(repository.entries).toEqual([]);
  });

  it('does not loop forever when a whole batch keeps failing', async () => {
    const ids = Array.from({ length: 60 }, (_, index) => `entry-${String(index).padStart(3, '0')}`);
    const { storage, useCase } = setup(ids.map((id) => buildEntry(id, daysAgo(31), [`https://cdn.test/${id}.jpg`])));
    ids.forEach((id) => storage.failingUrls.add(`https://cdn.test/${id}.jpg`));

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 0, failed: 60 });
  });

  it('does nothing when there is nothing to purge', async () => {
    const { useCase } = setup([]);

    await expect(useCase.execute(NOW)).resolves.toEqual({ purged: 0, failed: 0 });
  });
});
