import { ExportAccountUseCase } from './export-account.use-case';
import { AccountExportData, AccountExportLetter, AccountRepository } from '../domain/account.repository';
import { UserNotFoundError } from '../domain/user-not-found.error';

const NOW = new Date('2026-10-08T05:00:00.000Z');

function buildLetter(overrides: Partial<AccountExportLetter> = {}): AccountExportLetter {
  return {
    body: 'Dear future me',
    moodAtWriting: 'HAPPY',
    deliverAt: new Date('2026-12-01T01:00:00.000Z'),
    openedAt: null,
    createdAt: new Date('2026-09-01T01:00:00.000Z'),
    ...overrides,
  };
}

function buildData(letters: AccountExportLetter[] = []): AccountExportData {
  return {
    profile: {
      email: 'test@example.com',
      displayName: 'Ngân',
      avatarUrl: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    entries: [
      {
        entryDate: new Date('2026-10-07T00:00:00.000Z'),
        mood: 'HAPPY',
        note: 'A good day',
        photoUrls: ['https://cdn.test/photo.jpg'],
        isFavorite: true,
        songExternalId: null,
        songTitle: null,
        songArtist: null,
        songArtworkUrl: null,
        songPreviewUrl: null,
        createdAt: new Date('2026-10-07T12:00:00.000Z'),
        updatedAt: new Date('2026-10-07T12:00:00.000Z'),
      },
    ],
    letters,
  };
}

class FakeAccountRepository implements AccountRepository {
  constructor(private readonly data: AccountExportData | null) {}

  findExportData(): Promise<AccountExportData | null> {
    return Promise.resolve(this.data);
  }

  delete(): Promise<void> {
    throw new Error('not used in export-account tests');
  }
}

describe('ExportAccountUseCase', () => {
  it('returns the profile and entries as stored', async () => {
    const data = buildData();
    const useCase = new ExportAccountUseCase(new FakeAccountRepository(data));

    const result = await useCase.execute('user-1', NOW);

    expect(result.exportedAt).toEqual(NOW);
    expect(result.profile).toEqual(data.profile);
    expect(result.entries).toEqual(data.entries);
  });

  it('leaves out the body of letters that are still sealed', async () => {
    const useCase = new ExportAccountUseCase(new FakeAccountRepository(buildData([buildLetter()])));

    const [letter] = (await useCase.execute('user-1', NOW)).letters;

    expect(letter.status).toBe('sealed');
    expect(letter.body).toBeNull();
    expect(letter.deliverAt).toEqual(new Date('2026-12-01T01:00:00.000Z'));
  });

  it('includes the body once a letter has arrived, opened or not', async () => {
    const ready = buildLetter({ body: 'ready letter', deliverAt: new Date('2026-10-01T01:00:00.000Z') });
    const opened = buildLetter({
      body: 'opened letter',
      deliverAt: new Date('2026-10-01T01:00:00.000Z'),
      openedAt: new Date('2026-10-02T01:00:00.000Z'),
    });
    const useCase = new ExportAccountUseCase(new FakeAccountRepository(buildData([ready, opened])));

    const letters = (await useCase.execute('user-1', NOW)).letters;

    expect(letters.map((letter) => [letter.status, letter.body])).toEqual([
      ['ready', 'ready letter'],
      ['opened', 'opened letter'],
    ]);
  });

  it('throws UserNotFoundError when the user no longer exists', async () => {
    const useCase = new ExportAccountUseCase(new FakeAccountRepository(null));

    await expect(useCase.execute('user-1', NOW)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
