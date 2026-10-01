export class LetterLimitReachedError extends Error {
  constructor(limit: number) {
    super(`You already have ${limit} sealed letters waiting`);
    this.name = 'LetterLimitReachedError';
  }
}
