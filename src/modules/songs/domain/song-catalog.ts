export interface Song {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface SongCatalog {
  search(query: string, limit: number): Promise<Song[]>;
  findById(id: string): Promise<Song | null>;
}

export const SONG_CATALOG = Symbol('SONG_CATALOG');
