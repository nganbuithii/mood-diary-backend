export class IncorrectPasswordError extends Error {
  constructor() {
    super('Password is incorrect');
    this.name = 'IncorrectPasswordError';
  }
}
