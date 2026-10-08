import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReminderRecipient, ReminderRepository } from '../domain/reminder.repository';
import { ReminderSettings } from '../domain/reminder-settings';

const SETTINGS_SELECT = { reminderEnabled: true, reminderHour: true, timeZone: true } as const;

function toSettings(row: { reminderEnabled: boolean; reminderHour: number; timeZone: string }): ReminderSettings {
  return { enabled: row.reminderEnabled, hour: row.reminderHour, timeZone: row.timeZone };
}

@Injectable()
export class PrismaReminderRepository implements ReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSettings(userId: string): Promise<ReminderSettings | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: SETTINGS_SELECT });
    return row ? toSettings(row) : null;
  }

  async updateSettings(userId: string, settings: ReminderSettings): Promise<ReminderSettings | null> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { reminderEnabled: settings.enabled, reminderHour: settings.hour, timeZone: settings.timeZone },
    });
    return count > 0 ? settings : null;
  }

  async findEnabled(take: number, afterUserId?: string): Promise<ReminderRecipient[]> {
    const rows = await this.prisma.user.findMany({
      where: { reminderEnabled: true, id: afterUserId ? { gt: afterUserId } : undefined },
      select: { id: true, email: true, displayName: true, reminderSentOn: true, ...SETTINGS_SELECT },
      orderBy: { id: 'asc' },
      take,
    });
    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      displayName: row.displayName,
      settings: toSettings(row),
      reminderSentOn: row.reminderSentOn,
    }));
  }

  async hasLiveEntryOn(userId: string, day: Date): Promise<boolean> {
    const entry = await this.prisma.moodEntry.findFirst({
      where: { userId, entryDate: day, deletedAt: null },
      select: { id: true },
    });
    return entry !== null;
  }

  async claimDay(userId: string, day: Date): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, OR: [{ reminderSentOn: null }, { reminderSentOn: { not: day } }] },
      data: { reminderSentOn: day },
    });
    return count > 0;
  }

  async releaseDay(userId: string, day: Date, previous: Date | null): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, reminderSentOn: day },
      data: { reminderSentOn: previous },
    });
  }
}
