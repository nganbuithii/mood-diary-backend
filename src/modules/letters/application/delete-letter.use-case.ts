import { Inject, Injectable } from '@nestjs/common';
import { FUTURE_LETTER_REPOSITORY, FutureLetterRepository } from '../domain/future-letter.repository';
import { LetterNotFoundError } from '../domain/letter-not-found.error';

@Injectable()
export class DeleteLetterUseCase {
  constructor(
    @Inject(FUTURE_LETTER_REPOSITORY) private readonly letterRepository: FutureLetterRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const deleted = await this.letterRepository.delete(userId, id);
    if (!deleted) throw new LetterNotFoundError();
  }
}
