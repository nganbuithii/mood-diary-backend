import {
  CreateFutureLetterInput,
  DueLetterEmail,
  FutureLetterEntity,
  FutureLetterRepository,
  MAX_EMAIL_ATTEMPTS,
} from '../../domain/future-letter.repository';

export class InMemoryFutureLetterRepository implements FutureLetterRepository {
  private nextId = 1;

  constructor(
    public letters: FutureLetterEntity[] = [],
    private readonly emails: Record<string, string> = {},
  ) {}

  create(input: CreateFutureLetterInput): Promise<FutureLetterEntity> {
    const letter: FutureLetterEntity = {
      ...input,
      id: `letter-${this.nextId++}`,
      openedAt: null,
      emailSentAt: null,
      emailAttempts: 0,
      createdAt: new Date(),
    };
    this.letters.push(letter);
    return Promise.resolve(letter);
  }

  findManyByUser(userId: string): Promise<FutureLetterEntity[]> {
    return Promise.resolve(
      this.letters
        .filter((letter) => letter.userId === userId)
        .sort((a, b) => a.deliverAt.getTime() - b.deliverAt.getTime()),
    );
  }

  findByUserAndId(userId: string, id: string): Promise<FutureLetterEntity | null> {
    return Promise.resolve(this.letters.find((letter) => letter.id === id && letter.userId === userId) ?? null);
  }

  countSealedByUser(userId: string, now: Date): Promise<number> {
    return Promise.resolve(this.letters.filter((letter) => letter.userId === userId && letter.deliverAt > now).length);
  }

  async markOpened(userId: string, id: string, openedAt: Date): Promise<FutureLetterEntity | null> {
    const letter = await this.findByUserAndId(userId, id);
    if (letter && !letter.openedAt) letter.openedAt = openedAt;
    return letter;
  }

  delete(userId: string, id: string): Promise<boolean> {
    const before = this.letters.length;
    this.letters = this.letters.filter((letter) => !(letter.id === id && letter.userId === userId));
    return Promise.resolve(this.letters.length < before);
  }

  findDueForEmail(now: Date, take: number, afterId?: string): Promise<DueLetterEmail[]> {
    return Promise.resolve(
      this.letters
        .filter(
          (letter) =>
            letter.emailSentAt === null &&
            letter.openedAt === null &&
            letter.deliverAt <= now &&
            letter.emailAttempts < MAX_EMAIL_ATTEMPTS &&
            (!afterId || letter.id > afterId),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, take)
        .map((letter) => ({ letter, email: this.emails[letter.userId] ?? `${letter.userId}@test.dev` })),
    );
  }

  claimEmail(id: string, now: Date): Promise<boolean> {
    const letter = this.letters.find((item) => item.id === id);
    if (!letter || letter.emailSentAt) return Promise.resolve(false);
    letter.emailSentAt = now;
    return Promise.resolve(true);
  }

  releaseEmailClaim(id: string): Promise<void> {
    const letter = this.letters.find((item) => item.id === id);
    if (letter?.emailSentAt) {
      letter.emailSentAt = null;
      letter.emailAttempts++;
    }
    return Promise.resolve();
  }
}

export function buildLetter(overrides: Partial<FutureLetterEntity> = {}): FutureLetterEntity {
  return {
    id: 'letter-a',
    userId: 'user-1',
    body: 'Dear future me, hello.',
    moodAtWriting: 'HAPPY',
    deliverAt: new Date('2026-12-01T01:00:00.000Z'),
    openedAt: null,
    emailSentAt: null,
    emailAttempts: 0,
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    ...overrides,
  };
}
