export class DiaryEntryNotFoundError extends Error {
  constructor(date: string) {
    super(`No diary entry on ${date}`);
    this.name = 'DiaryEntryNotFoundError';
  }
}
