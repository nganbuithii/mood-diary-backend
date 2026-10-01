import { Inject, Injectable } from '@nestjs/common';
import { Mood } from '../../../shared/mood';
import { FUTURE_LETTER_REPOSITORY, FutureLetterRepository } from '../domain/future-letter.repository';
import { LetterStatus, letterStatus } from '../domain/letter-status';

export const LETTER_PREVIEW_LENGTH = 120;

export interface LetterSummary {
  id: string;
  deliverAt: Date;
  createdAt: Date;
  status: LetterStatus;
  moodAtWriting: Mood | null;
  preview: string | null;
}

@Injectable()
export class ListLettersUseCase {
  constructor(
    @Inject(FUTURE_LETTER_REPOSITORY) private readonly letterRepository: FutureLetterRepository,
  ) {}

  async execute(userId: string, now: Date = new Date()): Promise<LetterSummary[]> {
    const letters = await this.letterRepository.findManyByUser(userId);
    return letters.map((letter) => {
      const status = letterStatus(letter, now);
      return {
        id: letter.id,
        deliverAt: letter.deliverAt,
        createdAt: letter.createdAt,
        status,
        moodAtWriting: letter.moodAtWriting,
        preview: status === 'opened' ? letter.body.slice(0, LETTER_PREVIEW_LENGTH) : null,
      };
    });
  }
}
