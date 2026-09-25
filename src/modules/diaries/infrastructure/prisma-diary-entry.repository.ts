import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiaryEntryEntity, DiaryEntryRepository, UpsertDiaryEntryInput } from '../domain/diary-entry.repository';
import { Song } from '../../songs/domain/song-catalog';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaDiaryEntryRepository implements DiaryEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity> {
    try {
      return await this.runUpsert(input);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        return this.runUpsert(input);
      }
      throw error;
    }
  }

  private runUpsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity> {
    return this.prisma.moodEntry.upsert({
      where: { userId_entryDate: { userId: input.userId, entryDate: input.entryDate } },
      create: {
        userId: input.userId,
        entryDate: input.entryDate,
        mood: input.mood,
        note: input.note,
        photoUrls: input.photoUrls ?? [],
        ...toSongColumns(input.song),
      },
      update: {
        mood: input.mood,
        note: input.note,
        photoUrls: input.photoUrls,
        ...toSongColumns(input.song),
      },
    });
  }

  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]> {
    return this.prisma.moodEntry.findMany({
      where: { userId, entryDate: { gte: from, lt: to } },
      orderBy: { entryDate: 'asc' },
    });
  }
}

function toSongColumns(song: Song | null | undefined) {
  if (song === undefined) return {};
  return {
    songExternalId: song?.id ?? null,
    songTitle: song?.title ?? null,
    songArtist: song?.artist ?? null,
    songArtworkUrl: song?.artworkUrl ?? null,
    songPreviewUrl: song?.previewUrl ?? null,
  };
}
