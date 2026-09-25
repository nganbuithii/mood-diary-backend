import { DiariesService } from './diaries.service';
import { DiaryEntryEntity, DiaryEntryRepository, UpsertDiaryEntryInput } from '../domain/diary-entry.repository';
import { DiaryPhotoStorage, DiaryPhotoUploadResult } from '../domain/diary-photo-storage';
import { InvalidEntryDateError } from '../domain/invalid-entry-date.error';

function buildEntry(overrides: Partial<DiaryEntryEntity> = {}): DiaryEntryEntity {
  return {
    id: 'entry-1',
    userId: 'user-1',
    mood: 'HAPPY',
    note: null,
    photoUrls: [],
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
    return Promise.resolve(buildEntry(input));
  }

  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]> {
    this.findManyCalls.push({ userId, from, to });
    return Promise.resolve(
      this.entries.filter(
        (entry) => entry.userId === userId && entry.entryDate >= from && entry.entryDate < to,
      ),
    );
  }
}

class FakeDiaryPhotoStorage implements DiaryPhotoStorage {
  public uploadCalls: Array<{ userId: string; file: Buffer }> = [];

  upload(userId: string, file: Buffer): Promise<DiaryPhotoUploadResult> {
    this.uploadCalls.push({ userId, file });
    return Promise.resolve({ url: `https://cdn.test/${userId}/${this.uploadCalls.length}.jpg` });
  }
}

describe('DiariesService', () => {
  function setup(entries: DiaryEntryEntity[] = []) {
    const diaryEntryRepository = new FakeDiaryEntryRepository(entries);
    const diaryPhotoStorage = new FakeDiaryPhotoStorage();
    const service = new DiariesService(diaryEntryRepository, diaryPhotoStorage);
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
          photoUrls: [],
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
