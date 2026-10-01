import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateFutureLetterInput,
  DueLetterEmail,
  FutureLetterEntity,
  FutureLetterRepository,
  MAX_EMAIL_ATTEMPTS,
} from '../domain/future-letter.repository';

@Injectable()
export class PrismaFutureLetterRepository implements FutureLetterRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateFutureLetterInput): Promise<FutureLetterEntity> {
    return this.prisma.futureLetter.create({ data: input });
  }

  findManyByUser(userId: string): Promise<FutureLetterEntity[]> {
    return this.prisma.futureLetter.findMany({
      where: { userId },
      orderBy: [{ deliverAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findByUserAndId(userId: string, id: string): Promise<FutureLetterEntity | null> {
    return this.prisma.futureLetter.findFirst({ where: { id, userId } });
  }

  countSealedByUser(userId: string, now: Date): Promise<number> {
    return this.prisma.futureLetter.count({ where: { userId, deliverAt: { gt: now } } });
  }

  async markOpened(userId: string, id: string, openedAt: Date): Promise<FutureLetterEntity | null> {
    await this.prisma.futureLetter.updateMany({
      where: { id, userId, openedAt: null },
      data: { openedAt },
    });
    return this.findByUserAndId(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.futureLetter.deleteMany({ where: { id, userId } });
    return count > 0;
  }

  async findDueForEmail(now: Date, take: number, afterId?: string): Promise<DueLetterEmail[]> {
    const rows = await this.prisma.futureLetter.findMany({
      where: {
        emailSentAt: null,
        openedAt: null,
        deliverAt: { lte: now },
        emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
        id: afterId ? { gt: afterId } : undefined,
      },
      include: { user: { select: { email: true } } },
      orderBy: { id: 'asc' },
      take,
    });
    return rows.map(({ user, ...letter }) => ({ letter, email: user.email }));
  }

  async claimEmail(id: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.futureLetter.updateMany({
      where: { id, emailSentAt: null },
      data: { emailSentAt: now },
    });
    return count > 0;
  }

  async releaseEmailClaim(id: string): Promise<void> {
    await this.prisma.futureLetter.updateMany({
      where: { id, emailSentAt: { not: null } },
      data: { emailSentAt: null, emailAttempts: { increment: 1 } },
    });
  }
}
