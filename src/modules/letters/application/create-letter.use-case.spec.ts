import { CreateLetterUseCase, MAX_DELIVERY_DELAY_MS, MIN_DELIVERY_DELAY_MS } from './create-letter.use-case';
import { InMemoryFutureLetterRepository, buildLetter } from './testing/in-memory-future-letter.repository';
import { MAX_LETTER_LENGTH, MAX_SEALED_LETTERS } from '../domain/future-letter.repository';
import { InvalidLetterError } from '../domain/invalid-letter.error';
import { LetterLimitReachedError } from '../domain/letter-limit-reached.error';

const NOW = new Date('2026-10-01T10:00:00.000Z');
const NEXT_YEAR = new Date('2027-10-01T01:00:00.000Z');

function setup(letters = [] as ReturnType<typeof buildLetter>[]) {
  const repository = new InMemoryFutureLetterRepository(letters);
  return { repository, useCase: new CreateLetterUseCase(repository) };
}

describe('CreateLetterUseCase', () => {
  it('seals a letter with the trimmed body, delivery time and mood', async () => {
    const { repository, useCase } = setup();

    const letter = await useCase.execute(
      { userId: 'user-1', body: '  Dear me, hi!  ', deliverAt: NEXT_YEAR, moodAtWriting: 'HAPPY' },
      NOW,
    );

    expect(letter).toMatchObject({ userId: 'user-1', body: 'Dear me, hi!', deliverAt: NEXT_YEAR, moodAtWriting: 'HAPPY' });
    expect(repository.letters).toHaveLength(1);
  });

  it('stores no mood when none is given', async () => {
    const { useCase } = setup();

    const letter = await useCase.execute({ userId: 'user-1', body: 'hi', deliverAt: NEXT_YEAR }, NOW);

    expect(letter.moodAtWriting).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['only whitespace', '   \n  '],
    ['too long', 'x'.repeat(MAX_LETTER_LENGTH + 1)],
  ])('rejects a body that is %s', async (_label, body) => {
    const { repository, useCase } = setup();

    await expect(useCase.execute({ userId: 'user-1', body, deliverAt: NEXT_YEAR }, NOW)).rejects.toBeInstanceOf(
      InvalidLetterError,
    );
    expect(repository.letters).toHaveLength(0);
  });

  it('accepts a body of exactly the maximum length', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'user-1', body: 'x'.repeat(MAX_LETTER_LENGTH), deliverAt: NEXT_YEAR }, NOW),
    ).resolves.toBeDefined();
  });

  it.each([
    ['in the past', new Date(NOW.getTime() - 1000)],
    ['right now', NOW],
    ['too soon', new Date(NOW.getTime() + MIN_DELIVERY_DELAY_MS - 1)],
    ['more than 10 years away', new Date(NOW.getTime() + MAX_DELIVERY_DELAY_MS + 1)],
    ['not a real date', new Date('nope')],
  ])('rejects a delivery time %s', async (_label, deliverAt) => {
    const { useCase } = setup();

    await expect(useCase.execute({ userId: 'user-1', body: 'hi', deliverAt }, NOW)).rejects.toBeInstanceOf(
      InvalidLetterError,
    );
  });

  it('accepts 8:00 tomorrow even when written late at night', async () => {
    const lateNight = new Date('2026-10-01T16:59:00.000Z');
    const tomorrowMorning = new Date('2026-10-02T01:00:00.000Z');
    const { useCase } = setup();

    await expect(useCase.execute({ userId: 'user-1', body: 'hi', deliverAt: tomorrowMorning }, lateNight)).resolves.toBeDefined();
  });

  it('refuses once the user has the maximum number of sealed letters', async () => {
    const sealed = Array.from({ length: MAX_SEALED_LETTERS }, (_, index) =>
      buildLetter({ id: `sealed-${index}`, deliverAt: NEXT_YEAR }),
    );
    const { useCase } = setup(sealed);

    await expect(useCase.execute({ userId: 'user-1', body: 'hi', deliverAt: NEXT_YEAR }, NOW)).rejects.toBeInstanceOf(
      LetterLimitReachedError,
    );
  });

  it("doesn't count delivered letters or other users' letters toward the limit", async () => {
    const delivered = Array.from({ length: MAX_SEALED_LETTERS }, (_, index) =>
      buildLetter({ id: `delivered-${index}`, deliverAt: new Date('2026-09-01T01:00:00.000Z') }),
    );
    const othersSealed = Array.from({ length: MAX_SEALED_LETTERS }, (_, index) =>
      buildLetter({ id: `other-${index}`, userId: 'user-2', deliverAt: NEXT_YEAR }),
    );
    const { useCase } = setup([...delivered, ...othersSealed]);

    await expect(useCase.execute({ userId: 'user-1', body: 'hi', deliverAt: NEXT_YEAR }, NOW)).resolves.toBeDefined();
  });
});
