import { LETTER_PREVIEW_LENGTH, ListLettersUseCase } from './list-letters.use-case';
import { InMemoryFutureLetterRepository, buildLetter } from './testing/in-memory-future-letter.repository';

const NOW = new Date('2026-10-01T10:00:00.000Z');

describe('ListLettersUseCase', () => {
  const sealed = buildLetter({ id: 'sealed', body: 'secret', deliverAt: new Date('2027-01-01T01:00:00.000Z') });
  const ready = buildLetter({ id: 'ready', body: 'arrived', deliverAt: new Date('2026-09-30T01:00:00.000Z') });
  const opened = buildLetter({
    id: 'opened',
    body: 'y'.repeat(LETTER_PREVIEW_LENGTH + 50),
    deliverAt: new Date('2026-09-01T01:00:00.000Z'),
    openedAt: new Date('2026-09-02T08:00:00.000Z'),
  });

  it('gives each letter its status, soonest delivery first', async () => {
    const useCase = new ListLettersUseCase(new InMemoryFutureLetterRepository([sealed, ready, opened]));

    const letters = await useCase.execute('user-1', NOW);

    expect(letters.map((letter) => [letter.id, letter.status])).toEqual([
      ['opened', 'opened'],
      ['ready', 'ready'],
      ['sealed', 'sealed'],
    ]);
  });

  it('never exposes the words of a sealed or unopened letter', async () => {
    const useCase = new ListLettersUseCase(new InMemoryFutureLetterRepository([sealed, ready]));

    const letters = await useCase.execute('user-1', NOW);

    expect(letters.every((letter) => letter.preview === null)).toBe(true);
    expect(JSON.stringify(letters)).not.toContain('secret');
    expect(JSON.stringify(letters)).not.toContain('arrived');
  });

  it('shows the start of an opened letter as its preview', async () => {
    const useCase = new ListLettersUseCase(new InMemoryFutureLetterRepository([opened]));

    const [letter] = await useCase.execute('user-1', NOW);

    expect(letter.preview).toBe('y'.repeat(LETTER_PREVIEW_LENGTH));
  });

  it("only lists the user's own letters", async () => {
    const useCase = new ListLettersUseCase(
      new InMemoryFutureLetterRepository([sealed, buildLetter({ id: 'theirs', userId: 'user-2' })]),
    );

    const letters = await useCase.execute('user-1', NOW);

    expect(letters.map((letter) => letter.id)).toEqual(['sealed']);
  });
});
