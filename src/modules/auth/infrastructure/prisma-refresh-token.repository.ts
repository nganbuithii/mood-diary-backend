import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateRefreshTokenInput,
  RefreshTokenEntity,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    return this.prisma.refreshToken.create({ data: input });
  }

  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeIfActive(id: string, replacedByTokenId: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), replacedByTokenId },
    });
    return result.count === 1;
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
