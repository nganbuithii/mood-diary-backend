import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AchievementEntry,
  AchievementRepository,
  ReachedLevel,
  StoredAchievementLevel,
} from '../domain/achievement.repository';

@Injectable()
export class PrismaAchievementRepository implements AchievementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEntries(userId: string): Promise<AchievementEntry[]> {
    const rows = await this.prisma.moodEntry.findMany({
      where: { userId, deletedAt: null },
      select: { entryDate: true, mood: true, photoUrls: true, songTitle: true, isFavorite: true },
      orderBy: { entryDate: 'desc' },
    });
    return rows.map((row) => ({
      entryDate: row.entryDate,
      mood: row.mood,
      hasPhoto: row.photoUrls.length > 0,
      hasSong: row.songTitle !== null,
      isFavorite: row.isFavorite,
    }));
  }

  countLetters(userId: string): Promise<number> {
    return this.prisma.futureLetter.count({ where: { userId } });
  }

  findLevels(userId: string): Promise<StoredAchievementLevel[]> {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, level: true, seenLevel: true },
    });
  }

  // Insert if missing, then raise only where the stored level is lower, so whichever racing
  // request computed the higher level wins.
  async raiseLevels(userId: string, levels: ReachedLevel[]): Promise<void> {
    await this.prisma.userAchievement.createMany({
      data: levels.map(({ achievementId, level }) => ({ userId, achievementId, level })),
      skipDuplicates: true,
    });
    await Promise.all(
      levels.map(({ achievementId, level }) =>
        this.prisma.userAchievement.updateMany({
          where: { userId, achievementId, level: { lt: level } },
          data: { level },
        }),
      ),
    );
  }

  async markSeen(userId: string, achievementId: string): Promise<void> {
    const key = { userId_achievementId: { userId, achievementId } };
    const row = await this.prisma.userAchievement.findUnique({
      where: key,
      select: { level: true },
    });
    if (row)
      await this.prisma.userAchievement.update({ where: key, data: { seenLevel: row.level } });
  }
}
