import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurgeDeletedEntriesUseCase } from '../application/purge-deleted-entries.use-case';

@Injectable()
export class PurgeDeletedEntriesScheduler {
  private readonly logger = new Logger(PurgeDeletedEntriesScheduler.name);

  constructor(private readonly purgeDeletedEntriesUseCase: PurgeDeletedEntriesUseCase) {}

  @Cron('0 3 * * *', { name: 'purge-deleted-diary-entries', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      const { purged, failed } = await this.purgeDeletedEntriesUseCase.execute();
      this.logger.log(`Purged ${purged} deleted entr${purged === 1 ? 'y' : 'ies'}, ${failed} kept for retry`);
    } catch (error) {
      this.logger.error('Purging deleted diary entries failed', error instanceof Error ? error.stack : error);
    }
  }
}
