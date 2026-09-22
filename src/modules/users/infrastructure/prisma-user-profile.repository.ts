import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserProfileEntity, UserProfileRepository } from '../domain/user-profile.repository';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<UserProfileEntity | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updateAvatarUrl(id: string, avatarUrl: string): Promise<UserProfileEntity> {
    return this.prisma.user.update({ where: { id }, data: { avatarUrl } });
  }
}
