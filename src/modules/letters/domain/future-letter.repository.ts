import { Mood } from '../../../shared/mood';

export const MAX_LETTER_LENGTH = 5000;
export const MAX_SEALED_LETTERS = 50;
export const MAX_EMAIL_ATTEMPTS = 5;

export interface FutureLetterEntity {
  id: string;
  userId: string;
  body: string;
  moodAtWriting: Mood | null;
  deliverAt: Date;
  openedAt: Date | null;
  emailSentAt: Date | null;
  emailAttempts: number;
  createdAt: Date;
}

export interface CreateFutureLetterInput {
  userId: string;
  body: string;
  moodAtWriting: Mood | null;
  deliverAt: Date;
}

export interface DueLetterEmail {
  letter: FutureLetterEntity;
  email: string;
}

export interface FutureLetterRepository {
  create(input: CreateFutureLetterInput): Promise<FutureLetterEntity>;
  findManyByUser(userId: string): Promise<FutureLetterEntity[]>;
  findByUserAndId(userId: string, id: string): Promise<FutureLetterEntity | null>;
  countSealedByUser(userId: string, now: Date): Promise<number>;
  /** Sets openedAt only the first time; returns the letter either way, or null if it isn't the user's. */
  markOpened(userId: string, id: string, openedAt: Date): Promise<FutureLetterEntity | null>;
  delete(userId: string, id: string): Promise<boolean>;
  findDueForEmail(now: Date, take: number, afterId?: string): Promise<DueLetterEmail[]>;
  /** Marks the email as sent before sending, so two runs never both send it. */
  claimEmail(id: string, now: Date): Promise<boolean>;
  /** A no-op if the letter has since been deleted. */
  releaseEmailClaim(id: string): Promise<void>;
}

export const FUTURE_LETTER_REPOSITORY = Symbol('FUTURE_LETTER_REPOSITORY');
