import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountExportData, AccountRepository } from '../domain/account.repository';

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExportData(userId: string): Promise<AccountExportData | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        moodEntries: {
          where: { deletedAt: null },
          orderBy: { entryDate: 'asc' },
          select: {
            entryDate: true,
            mood: true,
            note: true,
            photoUrls: true,
            isFavorite: true,
            songExternalId: true,
            songTitle: true,
            songArtist: true,
            songArtworkUrl: true,
            songPreviewUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        futureLetters: {
          orderBy: { createdAt: 'asc' },
          select: { body: true, moodAtWriting: true, deliverAt: true, openedAt: true, createdAt: true },
        },
      },
    });
    if (!user) return null;

    const { moodEntries, futureLetters, ...profile } = user;
    return { profile, entries: moodEntries, letters: futureLetters };
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }
}
