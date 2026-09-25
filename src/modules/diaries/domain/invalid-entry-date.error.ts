export class InvalidEntryDateError extends Error {
  constructor(value: string) {
    super(`Invalid calendar date: ${value}`);
    this.name = 'InvalidEntryDateError';
  }
}
