export class MemoryDateOutOfRangeError extends Error {
  constructor(value: string) {
    super(`Date must be today in the user's timezone: ${value}`);
    this.name = 'MemoryDateOutOfRangeError';
  }
}
