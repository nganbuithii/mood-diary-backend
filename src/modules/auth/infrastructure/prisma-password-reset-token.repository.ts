import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePasswordResetTokenInput,
  PasswordResetTokenEntity,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenEntity> {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
