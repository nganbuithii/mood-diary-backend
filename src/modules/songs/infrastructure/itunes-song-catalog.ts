import { Injectable, Logger } from '@nestjs/common';
import { Song, SongCatalog } from '../domain/song-catalog';
import { SongCatalogUnavailableError } from '../domain/song-catalog-unavailable.error';

const ITUNES_BASE_URL = 'https://itunes.apple.com';
const REQUEST_TIMEOUT_MS = 5_000;

interface ItunesTrack {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
}

interface ItunesResponse {
  results?: ItunesTrack[];
}

@Injectable()
export class ItunesSongCatalog implements SongCatalog {
  private readonly logger = new Logger(ItunesSongCatalog.name);

  async search(query: string, limit: number): Promise<Song[]> {
    const params = new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: String(limit) });
    const tracks = await this.request(`/search?${params}`);
    return tracks.flatMap((track) => toSong(track) ?? []);
  }

  async findById(id: string): Promise<Song | null> {
    if (!/^\d+$/.test(id)) return null;

    const tracks = await this.request(`/lookup?${new URLSearchParams({ id, entity: 'song' })}`);
    return tracks.map(toSong).find((song) => song?.id === id) ?? null;
  }

  private async request(path: string): Promise<ItunesTrack[]> {
    try {
      const response = await fetch(`${ITUNES_BASE_URL}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`status ${response.status}`);

      const body = (await response.json()) as ItunesResponse;
      return body.results ?? [];
    } catch (error) {
      this.logger.error(`iTunes request failed: ${(error as Error).message}`);
      throw new SongCatalogUnavailableError((error as Error).message);
    }
  }
}

function toSong(track: ItunesTrack): Song | null {
  if (track.wrapperType !== 'track' || track.kind !== 'song') return null;
  if (!track.trackId || !track.trackName || !track.artistName) return null;

  return {
    id: String(track.trackId),
    title: track.trackName,
    artist: track.artistName,
    artworkUrl: track.artworkUrl100 ?? null,
    previewUrl: track.previewUrl ?? null,
  };
}
