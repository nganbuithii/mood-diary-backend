export class LetterNotFoundError extends Error {
  constructor() {
    super('Letter not found');
    this.name = 'LetterNotFoundError';
  }
}
