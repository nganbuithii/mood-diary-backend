export class SongCatalogUnavailableError extends Error {
  constructor(reason: string) {
    super(`Song catalog unavailable: ${reason}`);
    this.name = 'SongCatalogUnavailableError';
  }
}
