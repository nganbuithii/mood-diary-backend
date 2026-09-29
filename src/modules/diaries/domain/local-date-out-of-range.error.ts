export class LocalDateOutOfRangeError extends Error {
  constructor(value: string) {
    super(`Date must be today in the user's timezone: ${value}`);
    this.name = 'LocalDateOutOfRangeError';
  }
}
