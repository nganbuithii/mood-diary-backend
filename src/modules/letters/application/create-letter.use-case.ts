import { Inject, Injectable } from '@nestjs/common';
import { Mood } from '../../../shared/mood';
import {
  FUTURE_LETTER_REPOSITORY,
  FutureLetterEntity,
  FutureLetterRepository,
  MAX_LETTER_LENGTH,
  MAX_SEALED_LETTERS,
} from '../domain/future-letter.repository';
import { InvalidLetterError } from '../domain/invalid-letter.error';
import { LetterLimitReachedError } from '../domain/letter-limit-reached.error';

const HOUR_MS = 60 * 60 * 1000;
export const MIN_DELIVERY_DELAY_MS = 6 * HOUR_MS;
export const MAX_DELIVERY_DELAY_MS = (10 * 366 + 2) * 24 * HOUR_MS;

export interface CreateLetterInput {
  userId: string;
  body: string;
  deliverAt: Date;
  moodAtWriting?: Mood;
}

@Injectable()
export class CreateLetterUseCase {
  constructor(
    @Inject(FUTURE_LETTER_REPOSITORY) private readonly letterRepository: FutureLetterRepository,
  ) {}

  async execute(input: CreateLetterInput, now: Date = new Date()): Promise<FutureLetterEntity> {
    const body = input.body.trim();
    if (!body) throw new InvalidLetterError('A letter needs a few words');
    if (body.length > MAX_LETTER_LENGTH) {
      throw new InvalidLetterError(`A letter can be up to ${MAX_LETTER_LENGTH} characters`);
    }

    const delay = input.deliverAt.getTime() - now.getTime();
    if (Number.isNaN(delay) || delay < MIN_DELIVERY_DELAY_MS) {
      throw new InvalidLetterError('Pick a delivery day from tomorrow on');
    }
    if (delay > MAX_DELIVERY_DELAY_MS) throw new InvalidLetterError('A letter can wait up to 10 years');

    const sealed = await this.letterRepository.countSealedByUser(input.userId, now);
    if (sealed >= MAX_SEALED_LETTERS) throw new LetterLimitReachedError(MAX_SEALED_LETTERS);

    return this.letterRepository.create({
      userId: input.userId,
      body,
      moodAtWriting: input.moodAtWriting ?? null,
      deliverAt: input.deliverAt,
    });
  }
}
