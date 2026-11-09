import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GetAchievementsUseCase } from './application/get-achievements.use-case';
import { MarkAchievementSeenUseCase } from './application/mark-achievement-seen.use-case';
import { ACHIEVEMENT_REPOSITORY } from './domain/achievement.repository';
import { PrismaAchievementRepository } from './infrastructure/prisma-achievement.repository';
import { AchievementsController } from './presentation/achievements.controller';

@Module({
  imports: [AuthModule],
  controllers: [AchievementsController],
  providers: [
    GetAchievementsUseCase,
    MarkAchievementSeenUseCase,
    { provide: ACHIEVEMENT_REPOSITORY, useClass: PrismaAchievementRepository },
  ],
})
export class AchievementsModule {}
