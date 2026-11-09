import { Inject, Injectable } from '@nestjs/common';
import { isAchievementId } from '../domain/achievement-catalog';
import { ACHIEVEMENT_REPOSITORY, AchievementRepository } from '../domain/achievement.repository';
import { AchievementNotFoundError } from '../domain/achievement-not-found.error';

@Injectable()
export class MarkAchievementSeenUseCase {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY) private readonly achievementRepository: AchievementRepository,
  ) {}

  async execute(userId: string, achievementId: string): Promise<void> {
    if (!isAchievementId(achievementId)) throw new AchievementNotFoundError(achievementId);
    await this.achievementRepository.markSeen(userId, achievementId);
  }
}
