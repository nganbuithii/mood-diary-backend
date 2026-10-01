import { Inject, Injectable, Logger } from '@nestjs/common';
import { DIARY_ENTRY_REPOSITORY, DiaryEntryRepository } from '../domain/diary-entry.repository';
import { DIARY_PHOTO_STORAGE, DiaryPhotoStorage } from '../domain/diary-photo-storage';
import { DAY_MS } from './calendar-date';
import { deletePhotos } from './delete-photos';

export const DELETED_ENTRY_RETENTION_DAYS = 30;
const BATCH_SIZE = 50;

export interface PurgeResult {
  purged: number;
  /** Entries kept for the next run because some of their photos couldn't be deleted. */
  failed: number;
}

// Removes entries soft-deleted more than DELETED_ENTRY_RETENTION_DAYS ago, photos first.
// Safe to run again at any time: an entry whose photos fail stays soft-deleted and is retried.
@Injectable()
export class PurgeDeletedEntriesUseCase {
  private readonly logger = new Logger(PurgeDeletedEntriesUseCase.name);

  constructor(
    @Inject(DIARY_ENTRY_REPOSITORY) private readonly diaryEntryRepository: DiaryEntryRepository,
    @Inject(DIARY_PHOTO_STORAGE) private readonly diaryPhotoStorage: DiaryPhotoStorage,
  ) {}

  async execute(now: Date = new Date()): Promise<PurgeResult> {
    const cutoff = new Date(now.getTime() - DELETED_ENTRY_RETENTION_DAYS * DAY_MS);
    const result: PurgeResult = { purged: 0, failed: 0 };

    let afterId: string | undefined;
    for (;;) {
      const batch = await this.diaryEntryRepository.findDeletedBefore(cutoff, BATCH_SIZE, afterId);
      for (const entry of batch) {
        const failedPhotos = await deletePhotos(this.diaryPhotoStorage, entry.photoUrls);
        if (failedPhotos.length > 0) {
          // Keep the row: it's the only record of which photos still need deleting.
          this.logger.warn(`Kept entry ${entry.id}: couldn't delete photo(s) ${failedPhotos.join(', ')}`);
          result.failed++;
          continue;
        }
        if (await this.diaryEntryRepository.purge(entry.id, cutoff)) result.purged++;
      }
      if (batch.length < BATCH_SIZE) break;
      afterId = batch[batch.length - 1].id;
    }

    return result;
  }
}
