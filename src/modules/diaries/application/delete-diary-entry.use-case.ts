import { Inject, Injectable } from '@nestjs/common';
import { DIARY_ENTRY_REPOSITORY, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DiaryEntryNotFoundError } from '../domain/diary-entry-not-found.error';
import { parseCalendarDate } from './calendar-date';

export interface DeleteDiaryEntryInput {
  userId: string;
  date: string;
}

@Injectable()
export class DeleteDiaryEntryUseCase {
  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
  ) {}

  async execute(input: DeleteDiaryEntryInput, now: Date = new Date()): Promise<void> {
    const entryDate = parseCalendarDate(input.date);
    const deleted = await this.diaryEntryRepository.softDelete(input.userId, entryDate, now);
    if (!deleted) throw new DiaryEntryNotFoundError(input.date);
  }
}
