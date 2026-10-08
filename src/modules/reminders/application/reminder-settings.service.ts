import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../users/domain/user-not-found.error';
import { InvalidTimeZoneError } from '../domain/invalid-time-zone.error';
import { REMINDER_REPOSITORY, ReminderRepository } from '../domain/reminder.repository';
import { ReminderSettings, isValidTimeZone } from '../domain/reminder-settings';

@Injectable()
export class ReminderSettingsService {
  constructor(@Inject(REMINDER_REPOSITORY) private readonly reminderRepository: ReminderRepository) {}

  async get(userId: string): Promise<ReminderSettings> {
    const settings = await this.reminderRepository.findSettings(userId);
    if (!settings) {
      throw new UserNotFoundError(userId);
    }
    return settings;
  }

  async update(userId: string, settings: ReminderSettings): Promise<ReminderSettings> {
    if (!isValidTimeZone(settings.timeZone)) {
      throw new InvalidTimeZoneError(settings.timeZone);
    }

    const updated = await this.reminderRepository.updateSettings(userId, settings);
    if (!updated) {
      throw new UserNotFoundError(userId);
    }
    return updated;
  }
}
