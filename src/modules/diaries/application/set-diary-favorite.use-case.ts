import { Inject, Injectable } from '@nestjs/common';
import { DIARY_ENTRY_REPOSITORY, DiaryEntryEntity, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DiaryEntryNotFoundError } from '../domain/diary-entry-not-found.error';
import { parseCalendarDate } from './calendar-date';

export interface SetDiaryFavoriteInput {
  userId: string;
  date: string;
  isFavorite: boolean;
}

@Injectable()
export class SetDiaryFavoriteUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: SetDiaryFavoriteInput): Promise<DiaryEntryEntity> {
    const entryDate = parseCalendarDate(input.date);
    const entry = await this.diaryEntryRepository.setFavorite(input.userId, entryDate, input.isFavorite);
    if (!entry) throw new DiaryEntryNotFoundError(input.date);
    return entry;
  }
}
