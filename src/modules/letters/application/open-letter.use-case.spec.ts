import { OpenLetterUseCase } from './open-letter.use-case';
import { DeleteLetterUseCase } from './delete-letter.use-case';
import { InMemoryFutureLetterRepository, buildLetter } from './testing/in-memory-future-letter.repository';
import { LetterNotFoundError } from '../domain/letter-not-found.error';
import { LetterSealedError } from '../domain/letter-sealed.error';

const NOW = new Date('2026-10-01T10:00:00.000Z');

function setup(letters = [] as ReturnType<typeof buildLetter>[]) {
  const repository = new InMemoryFutureLetterRepository(letters);
  return {
    repository,
    openLetter: new OpenLetterUseCase(repository),
    deleteLetter: new DeleteLetterUseCase(repository),
  };
}

describe('OpenLetterUseCase', () => {
  it('opens a letter whose day has come and records when', async () => {
    const { openLetter } = setup([buildLetter({ deliverAt: new Date('2026-10-01T01:00:00.000Z') })]);

    const letter = await openLetter.execute('user-1', 'letter-a', NOW);

    expect(letter.body).toBe('Dear future me, hello.');
    expect(letter.openedAt).toEqual(NOW);
  });

  it('opens a letter exactly at its delivery time', async () => {
    const { openLetter } = setup([buildLetter({ deliverAt: NOW })]);

    await expect(openLetter.execute('user-1', 'letter-a', NOW)).resolves.toBeDefined();
  });

  it('refuses to open a letter before its delivery time, without marking it opened', async () => {
    const deliverAt = new Date(NOW.getTime() + 1000);
    const { repository, openLetter } = setup([buildLetter({ deliverAt })]);

    const error = await openLetter.execute('user-1', 'letter-a', NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LetterSealedError);
    expect((error as LetterSealedError).deliverAt).toEqual(deliverAt);
    expect(repository.letters[0].openedAt).toBeNull();
  });

  it('keeps the first opening time when reopened', async () => {
    const firstOpened = new Date('2026-09-15T08:00:00.000Z');
    const { openLetter } = setup([buildLetter({ deliverAt: new Date('2026-09-01T01:00:00.000Z'), openedAt: firstOpened })]);

    const letter = await openLetter.execute('user-1', 'letter-a', NOW);

    expect(letter.openedAt).toEqual(firstOpened);
  });

  it("cannot open another user's letter", async () => {
    const { openLetter } = setup([buildLetter({ userId: 'user-2', deliverAt: new Date('2026-09-01T01:00:00.000Z') })]);

    await expect(openLetter.execute('user-1', 'letter-a', NOW)).rejects.toBeInstanceOf(LetterNotFoundError);
  });

  it('throws LetterNotFoundError for an unknown letter', async () => {
    const { openLetter } = setup([]);

    await expect(openLetter.execute('user-1', 'nope', NOW)).rejects.toBeInstanceOf(LetterNotFoundError);
  });
});

describe('DeleteLetterUseCase', () => {
  it('deletes a letter, sealed or not', async () => {
    const { repository, deleteLetter } = setup([buildLetter()]);

    await deleteLetter.execute('user-1', 'letter-a');

    expect(repository.letters).toEqual([]);
  });

  it("cannot delete another user's letter", async () => {
    const { repository, deleteLetter } = setup([buildLetter({ userId: 'user-2' })]);

    await expect(deleteLetter.execute('user-1', 'letter-a')).rejects.toBeInstanceOf(LetterNotFoundError);
    expect(repository.letters).toHaveLength(1);
  });

  it('throws LetterNotFoundError for an unknown letter', async () => {
    const { deleteLetter } = setup([]);

    await expect(deleteLetter.execute('user-1', 'nope')).rejects.toBeInstanceOf(LetterNotFoundError);
  });
});
