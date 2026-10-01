import { Inject, Injectable } from '@nestjs/common';
import { FUTURE_LETTER_REPOSITORY, FutureLetterEntity, FutureLetterRepository } from '../domain/future-letter.repository';
import { letterStatus } from '../domain/letter-status';
import { LetterNotFoundError } from '../domain/letter-not-found.error';
import { LetterSealedError } from '../domain/letter-sealed.error';

export type OpenedLetter = FutureLetterEntity & { openedAt: Date };

@Injectable()
export class OpenLetterUseCase {
  constructor(
    @Inject(FUTURE_LETTER_REPOSITORY) private readonly letterRepository: FutureLetterRepository,
  ) {}

  async execute(userId: string, id: string, now: Date = new Date()): Promise<OpenedLetter> {
    const letter = await this.letterRepository.findByUserAndId(userId, id);
    if (!letter) throw new LetterNotFoundError();
    if (letterStatus(letter, now) === 'sealed') throw new LetterSealedError(letter.deliverAt);
    if (letter.openedAt) return { ...letter, openedAt: letter.openedAt };

    const opened = await this.letterRepository.markOpened(userId, id, now);
    if (!opened) throw new LetterNotFoundError();
    return { ...opened, openedAt: opened.openedAt ?? now };
  }
}
