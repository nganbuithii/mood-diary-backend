export class LetterSealedError extends Error {
  constructor(readonly deliverAt: Date) {
    super(`This letter is sealed until ${deliverAt.toISOString()}`);
    this.name = 'LetterSealedError';
  }
}
