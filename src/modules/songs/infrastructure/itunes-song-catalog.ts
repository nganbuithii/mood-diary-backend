import { Injectable, Logger } from '@nestjs/common';
import { Song, SongCatalog } from '../domain/song-catalog';
import { SongCatalogUnavailableError } from '../domain/song-catalog-unavailable.error';

const ITUNES_BASE_URL = 'https://itunes.apple.com';
const TRENDING_CHART_URL = 'https://rss.marketingtools.apple.com/api/v2/vn/music/most-played/20/songs.json';
const TRENDING_CACHE_TTL_MS = 60 * 60_000;
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

interface ChartResponse {
  feed?: { results?: Array<{ id?: string }> };
}

@Injectable()
export class ItunesSongCatalog implements SongCatalog {
  private readonly logger = new Logger(ItunesSongCatalog.name);
  private trendingCache: { songs: Song[]; expiresAt: number } | null = null;

  async search(query: string, limit: number): Promise<Song[]> {
    const params = new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: String(limit) });
    const { results = [] } = await this.getJson<ItunesResponse>(`${ITUNES_BASE_URL}/search?${params}`);
    return results.flatMap((track) => toSong(track) ?? []);
  }

  async findById(id: string): Promise<Song | null> {
    if (!/^\d+$/.test(id)) return null;

    const songs = await this.lookup([id]);
    return songs.find((song) => song.id === id) ?? null;
  }

  async trending(): Promise<Song[]> {
    if (this.trendingCache && this.trendingCache.expiresAt > Date.now()) {
      return this.trendingCache.songs;
    }

    const chart = await this.getJson<ChartResponse>(TRENDING_CHART_URL);
    const ids = (chart.feed?.results ?? []).flatMap((item) => (item.id && /^\d+$/.test(item.id) ? [item.id] : []));
    const songsById = new Map((await this.lookup(ids)).map((song) => [song.id, song]));
    const songs = ids.flatMap((id) => songsById.get(id) ?? []);

    this.trendingCache = { songs, expiresAt: Date.now() + TRENDING_CACHE_TTL_MS };
    return songs;
  }

  private async lookup(ids: string[]): Promise<Song[]> {
    if (ids.length === 0) return [];

    const params = new URLSearchParams({ id: ids.join(','), entity: 'song' });
    const { results = [] } = await this.getJson<ItunesResponse>(`${ITUNES_BASE_URL}/lookup?${params}`);
    return results.flatMap((track) => toSong(track) ?? []);
  }

  private async getJson<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(`Song catalog request failed (${url}): ${(error as Error).message}`);
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
