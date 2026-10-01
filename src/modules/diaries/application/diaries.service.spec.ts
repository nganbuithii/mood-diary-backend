import { DiariesService } from './diaries.service';
import { DiaryEntryEntity, DiaryEntryRepository, UpsertDiaryEntryInput } from '../domain/diary-entry.repository';
import { DiaryPhotoStorage, DiaryPhotoUploadResult } from '../domain/diary-photo-storage';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';
import { SongNotFoundError } from '../domain/song-not-found.error';
import { Song, SongCatalog } from '../../songs/domain/song-catalog';

const SUNFLOWER: Song = {
  id: '1445931937',
  title: 'Sunflower',
  artist: 'Post Malone & Swae Lee',
  artworkUrl: 'https://cdn.test/sunflower.jpg',
  previewUrl: 'https://cdn.test/sunflower.m4a',
};

function buildEntry(overrides: Partial<DiaryEntryEntity> = {}): DiaryEntryEntity {
  return {
    id: 'entry-1',
    userId: 'user-1',
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
    entryDate: new Date('2026-09-25T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeDiaryEntryRepository implements DiaryEntryRepository {
  public upsertCalls: UpsertDiaryEntryInput[] = [];
  public findManyCalls: Array<{ userId: string; from: Date; to: Date }> = [];

  constructor(private readonly entries: DiaryEntryEntity[] = []) {}

  upsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity> {
    this.upsertCalls.push(input);
    const { song, photoUrls, ...rest } = input;
    // Like the real repository: photoUrls left undefined keeps the photos already on that day's row.
    const existing = this.entries.find(
      (entry) => entry.userId === input.userId && entry.entryDate.getTime() === input.entryDate.getTime(),
    );
    return Promise.resolve(
      buildEntry({
        ...rest,
        photoUrls: photoUrls ?? existing?.photoUrls ?? [],
        songExternalId: song?.id ?? null,
        songTitle: song?.title ?? null,
        songArtist: song?.artist ?? null,
        songArtworkUrl: song?.artworkUrl ?? null,
        songPreviewUrl: song?.previewUrl ?? null,
      }),
    );
  }

  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]> {
    this.findManyCalls.push({ userId, from, to });
    return Promise.resolve(
      this.entries.filter(
        (entry) => entry.userId === userId && entry.entryDate >= from && entry.entryDate < to,
      ),
    );
  }

  findByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null> {
    return Promise.resolve(
      this.entries.find(
        (entry) =>
          entry.userId === userId &&
          entry.entryDate.getTime() === entryDate.getTime() &&
          entry.deletedAt === null,
      ) ?? null,
    );
  }

  countByUserOnOrBefore(): Promise<number> {
    throw new Error('not used in DiariesService tests');
  }

  findByUserOnOrBeforeAt(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in DiariesService tests');
  }

  findEntryDatesOnOrBefore(): Promise<Date[]> {
    throw new Error('not used in DiariesService tests');
  }

  findPageNewestFirst(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in DiariesService tests');
  }

  setFavorite(): Promise<DiaryEntryEntity | null> {
    throw new Error('not used in DiariesService tests');
  }

  findDeletedByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null> {
    return Promise.resolve(
      this.entries.find(
        (entry) =>
          entry.userId === userId &&
          entry.entryDate.getTime() === entryDate.getTime() &&
          entry.deletedAt !== null,
      ) ?? null,
    );
  }

  softDelete(): Promise<boolean> {
    throw new Error('not used in DiariesService tests');
  }

  findDeletedBefore(): Promise<DiaryEntryEntity[]> {
    throw new Error('not used in DiariesService tests');
  }

  purge(): Promise<boolean> {
    throw new Error('not used in DiariesService tests');
  }
}

class FakeDiaryPhotoStorage implements DiaryPhotoStorage {
  public uploadCalls: Array<{ userId: string; file: Buffer }> = [];
  public deletedUrls: string[] = [];
  public failingUrls = new Set<string>();

  upload(userId: string, file: Buffer): Promise<DiaryPhotoUploadResult> {
    this.uploadCalls.push({ userId, file });
    return Promise.resolve({ url: `https://cdn.test/${userId}/${this.uploadCalls.length}.jpg` });
  }

  delete(url: string): Promise<void> {
    if (this.failingUrls.has(url)) return Promise.reject(new Error('storage down'));
    this.deletedUrls.push(url);
    return Promise.resolve();
  }
}

class FakeSongCatalog implements SongCatalog {
  constructor(private readonly songs: Song[] = [SUNFLOWER]) {}

  search(query: string): Promise<Song[]> {
    return Promise.resolve(this.songs.filter((song) => song.title.includes(query)));
  }

  findById(id: string): Promise<Song | null> {
    return Promise.resolve(this.songs.find((song) => song.id === id) ?? null);
  }

  trending(): Promise<Song[]> {
    return Promise.resolve(this.songs);
  }
}

describe('DiariesService', () => {
  function setup(entries: DiaryEntryEntity[] = []) {
    const diaryEntryRepository = new FakeDiaryEntryRepository(entries);
    const diaryPhotoStorage = new FakeDiaryPhotoStorage();
    const service = new DiariesService(diaryEntryRepository, diaryPhotoStorage, new FakeSongCatalog());
    return { service, diaryEntryRepository, diaryPhotoStorage };
  }

  describe('upsertEntry', () => {
    it('parses the date and trims the note before upserting', async () => {
      const { service, diaryEntryRepository } = setup();

      const entry = await service.upsertEntry({
        userId: 'user-1',
        date: '2026-09-25',
        mood: 'HAPPY',
        note: '  Great day  ',
      });

      expect(diaryEntryRepository.upsertCalls).toEqual([
        {
          userId: 'user-1',
          entryDate: new Date('2026-09-25T00:00:00.000Z'),
          mood: 'HAPPY',
          note: 'Great day',
          photoUrls: undefined,
        },
      ]);
      expect(entry.note).toBe('Great day');
    });

    it('normalizes a missing or blank note to null', async () => {
      const { service, diaryEntryRepository } = setup();

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'NEUTRAL', note: '   ' });

      expect(diaryEntryRepository.upsertCalls[0]).toMatchObject({ note: null });
    });

    it('rejects a shape-valid but nonexistent calendar date', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup();

      await expect(
        service.upsertEntry({
          userId: 'user-1',
          date: '2026-02-30',
          mood: 'HAPPY',
          photos: [Buffer.from('x')],
        }),
      ).rejects.toThrow(InvalidEntryDateError);
      expect(diaryEntryRepository.upsertCalls).toHaveLength(0);
      expect(diaryPhotoStorage.uploadCalls).toHaveLength(0);
    });

    it('uploads each photo and stores the resulting URLs', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup();

      const entry = await service.upsertEntry({
        userId: 'user-1',
        date: '2026-09-25',
        mood: 'HAPPY',
        photos: [Buffer.from('a'), Buffer.from('b')],
      });

      expect(diaryPhotoStorage.uploadCalls).toHaveLength(2);
      expect(diaryEntryRepository.upsertCalls[0].photoUrls).toEqual([
        'https://cdn.test/user-1/1.jpg',
        'https://cdn.test/user-1/2.jpg',
      ]);
      expect(entry.photoUrls).toHaveLength(2);
    });

    it('leaves existing photos untouched when no photos are sent', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup();

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'SAD', photos: [] });

      expect(diaryPhotoStorage.uploadCalls).toHaveLength(0);
      expect(diaryEntryRepository.upsertCalls[0].photoUrls).toBeUndefined();
    });

    it('caps uploads at MAX_ENTRY_PHOTOS even if more files are sent', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup();

      await service.upsertEntry({
        userId: 'user-1',
        date: '2026-09-25',
        mood: 'HAPPY',
        photos: [Buffer.from('a'), Buffer.from('b'), Buffer.from('c'), Buffer.from('d')],
      });

      expect(diaryPhotoStorage.uploadCalls).toHaveLength(3);
      expect(diaryEntryRepository.upsertCalls[0].photoUrls).toHaveLength(3);
    });

    it('leaves the current song untouched when no songId is sent', async () => {
      const { service, diaryEntryRepository } = setup();

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'HAPPY' });

      expect(diaryEntryRepository.upsertCalls[0].song).toBeUndefined();
    });

    it('clears the song when songId is an empty string', async () => {
      const { service, diaryEntryRepository } = setup();

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'HAPPY', songId: '' });

      expect(diaryEntryRepository.upsertCalls[0].song).toBeNull();
    });

    it('stores a snapshot of the song looked up from the catalog', async () => {
      const { service, diaryEntryRepository } = setup();

      const entry = await service.upsertEntry({
        userId: 'user-1',
        date: '2026-09-25',
        mood: 'HAPPY',
        songId: SUNFLOWER.id,
      });

      expect(diaryEntryRepository.upsertCalls[0].song).toEqual(SUNFLOWER);
      expect(entry.songTitle).toBe('Sunflower');
    });

    it('rejects an unknown songId before uploading any photo', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup();

      await expect(
        service.upsertEntry({
          userId: 'user-1',
          date: '2026-09-25',
          mood: 'HAPPY',
          songId: '999',
          photos: [Buffer.from('a')],
        }),
      ).rejects.toThrow(SongNotFoundError);
      expect(diaryPhotoStorage.uploadCalls).toHaveLength(0);
      expect(diaryEntryRepository.upsertCalls).toHaveLength(0);
    });

    describe('on a day whose entry was deleted', () => {
      const deletedEntry = buildEntry({
        photoUrls: ['https://cdn.test/old.jpg'],
        songExternalId: SUNFLOWER.id,
        songTitle: SUNFLOWER.title,
        songArtist: SUNFLOWER.artist,
        isFavorite: true,
        deletedAt: new Date('2026-09-26T00:00:00.000Z'),
      });

      it('starts a fresh page: clears photos, song and favorite left from the deleted entry', async () => {
        const { service, diaryEntryRepository } = setup([deletedEntry]);

        await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'SAD' });

        expect(diaryEntryRepository.upsertCalls[0]).toMatchObject({ photoUrls: [], song: null, isFavorite: false });
      });

      it('still uses the photos and song sent with the new entry', async () => {
        const { service, diaryEntryRepository } = setup([deletedEntry]);

        await service.upsertEntry({
          userId: 'user-1',
          date: '2026-09-25',
          mood: 'SAD',
          photos: [Buffer.from('a')],
          songId: SUNFLOWER.id,
        });

        expect(diaryEntryRepository.upsertCalls[0]).toMatchObject({
          photoUrls: ['https://cdn.test/user-1/1.jpg'],
          song: SUNFLOWER,
          isFavorite: false,
        });
      });

      it("ignores another user's deleted entry on the same date", async () => {
        const { service, diaryEntryRepository } = setup([{ ...deletedEntry, userId: 'user-2' }]);

        await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'SAD' });

        expect(diaryEntryRepository.upsertCalls[0].photoUrls).toBeUndefined();
        expect(diaryEntryRepository.upsertCalls[0].isFavorite).toBeUndefined();
      });
    });
  });

  describe('upsertEntry photo cleanup', () => {
    const liveEntry = buildEntry({ photoUrls: ['https://cdn.test/old-1.jpg', 'https://cdn.test/old-2.jpg'] });

    it('deletes the previous photos from storage once new ones replace them', async () => {
      const { service, diaryPhotoStorage } = setup([liveEntry]);

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'HAPPY', photos: [Buffer.from('a')] });

      expect(diaryPhotoStorage.deletedUrls).toEqual(['https://cdn.test/old-1.jpg', 'https://cdn.test/old-2.jpg']);
    });

    it('keeps the photos when the edit sends no new ones', async () => {
      const { service, diaryPhotoStorage } = setup([liveEntry]);

      const entry = await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'SAD', note: 'edited' });

      expect(diaryPhotoStorage.deletedUrls).toEqual([]);
      expect(entry.photoUrls).toEqual(liveEntry.photoUrls);
    });

    it("deletes the deleted entry's photos when writing on that day again", async () => {
      const deletedEntry = buildEntry({
        photoUrls: ['https://cdn.test/old-1.jpg'],
        deletedAt: new Date('2026-09-26T00:00:00.000Z'),
      });
      const { service, diaryPhotoStorage } = setup([deletedEntry]);

      await service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'SAD' });

      expect(diaryPhotoStorage.deletedUrls).toEqual(['https://cdn.test/old-1.jpg']);
    });

    it('still saves the entry when a replaced photo cannot be deleted', async () => {
      const { service, diaryPhotoStorage } = setup([liveEntry]);
      diaryPhotoStorage.failingUrls.add('https://cdn.test/old-1.jpg');

      const entry = await service.upsertEntry({
        userId: 'user-1',
        date: '2026-09-25',
        mood: 'HAPPY',
        photos: [Buffer.from('a')],
      });

      expect(entry.photoUrls).toEqual(['https://cdn.test/user-1/1.jpg']);
      expect(diaryPhotoStorage.deletedUrls).toEqual(['https://cdn.test/old-2.jpg']);
    });

    it('does not touch storage when the save itself fails', async () => {
      const { service, diaryEntryRepository, diaryPhotoStorage } = setup([liveEntry]);
      diaryEntryRepository.upsert = () => Promise.reject(new Error('db down'));

      await expect(
        service.upsertEntry({ userId: 'user-1', date: '2026-09-25', mood: 'HAPPY', photos: [Buffer.from('a')] }),
      ).rejects.toThrow('db down');
      expect(diaryPhotoStorage.deletedUrls).toEqual([]);
    });
  });

  describe('listEntriesForMonth', () => {
    it('queries the repository with the UTC month boundaries', async () => {
      const { service, diaryEntryRepository } = setup();

      await service.listEntriesForMonth('user-1', '2026-09');

      expect(diaryEntryRepository.findManyCalls).toEqual([
        {
          userId: 'user-1',
          from: new Date('2026-09-01T00:00:00.000Z'),
          to: new Date('2026-10-01T00:00:00.000Z'),
        },
      ]);
    });

    it('rolls the range over correctly for December', async () => {
      const { service, diaryEntryRepository } = setup();

      await service.listEntriesForMonth('user-1', '2026-12');

      expect(diaryEntryRepository.findManyCalls).toEqual([
        {
          userId: 'user-1',
          from: new Date('2026-12-01T00:00:00.000Z'),
          to: new Date('2027-01-01T00:00:00.000Z'),
        },
      ]);
    });

    it('returns only entries within range for that user', async () => {
      const inRange = buildEntry({ id: 'entry-in-range', entryDate: new Date('2026-09-10T00:00:00.000Z') });
      const outOfRange = buildEntry({ id: 'entry-out-of-range', entryDate: new Date('2026-08-31T00:00:00.000Z') });
      const otherUser = buildEntry({
        id: 'entry-other-user',
        userId: 'user-2',
        entryDate: new Date('2026-09-15T00:00:00.000Z'),
      });
      const { service } = setup([inRange, outOfRange, otherUser]);

      const result = await service.listEntriesForMonth('user-1', '2026-09');

      expect(result).toEqual([inRange]);
    });
  });
});
