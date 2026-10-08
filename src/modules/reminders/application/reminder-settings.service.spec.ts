import { UserNotFoundError } from '../../users/domain/user-not-found.error';
import { InvalidTimeZoneError } from '../domain/invalid-time-zone.error';
import { ReminderRecipient, ReminderRepository } from '../domain/reminder.repository';
import { ReminderSettings } from '../domain/reminder-settings';
import { ReminderSettingsService } from './reminder-settings.service';

class InMemoryReminderRepository implements ReminderRepository {
  constructor(private readonly settingsByUser: Map<string, ReminderSettings>) {}

  findSettings(userId: string): Promise<ReminderSettings | null> {
    return Promise.resolve(this.settingsByUser.get(userId) ?? null);
  }

  updateSettings(userId: string, settings: ReminderSettings): Promise<ReminderSettings | null> {
    if (!this.settingsByUser.has(userId)) return Promise.resolve(null);
    this.settingsByUser.set(userId, settings);
    return Promise.resolve(settings);
  }

  findEnabled(): Promise<ReminderRecipient[]> {
    throw new Error('not used in settings tests');
  }

  hasLiveEntryOn(): Promise<boolean> {
    throw new Error('not used in settings tests');
  }

  claimDay(): Promise<boolean> {
    throw new Error('not used in settings tests');
  }

  releaseDay(): Promise<void> {
    throw new Error('not used in settings tests');
  }
}

describe('ReminderSettingsService', () => {
  const defaults: ReminderSettings = { enabled: false, hour: 20, timeZone: 'UTC' };

  function setup() {
    const repository = new InMemoryReminderRepository(new Map([['user-1', defaults]]));
    return { repository, service: new ReminderSettingsService(repository) };
  }

  it('saves valid settings', async () => {
    const { service } = setup();
    const next = { enabled: true, hour: 9, timeZone: 'Asia/Ho_Chi_Minh' };

    await expect(service.update('user-1', next)).resolves.toEqual(next);
    await expect(service.get('user-1')).resolves.toEqual(next);
  });

  it('rejects an unknown time zone without saving', async () => {
    const { service } = setup();

    await expect(service.update('user-1', { enabled: true, hour: 9, timeZone: 'Mars/Olympus' })).rejects.toBeInstanceOf(
      InvalidTimeZoneError,
    );
    await expect(service.get('user-1')).resolves.toEqual(defaults);
  });

  it('throws UserNotFoundError for a missing user', async () => {
    const { service } = setup();

    await expect(service.get('ghost')).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(service.update('ghost', defaults)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
