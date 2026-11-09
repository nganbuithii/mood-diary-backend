export class AchievementNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown achievement: ${id}`);
    this.name = 'AchievementNotFoundError';
  }
}
