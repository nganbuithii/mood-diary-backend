export class InvalidFeedCursorError extends Error {
  constructor() {
    super('Invalid feed cursor');
    this.name = 'InvalidFeedCursorError';
  }
}
