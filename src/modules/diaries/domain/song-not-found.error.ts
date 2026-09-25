export class SongNotFoundError extends Error {
  constructor(songId: string) {
    super(`Song not found: ${songId}`);
    this.name = 'SongNotFoundError';
  }
}
