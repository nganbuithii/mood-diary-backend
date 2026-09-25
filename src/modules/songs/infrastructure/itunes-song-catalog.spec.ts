import { ItunesSongCatalog } from './itunes-song-catalog';
import { SongCatalogUnavailableError } from '../domain/song-catalog-unavailable.error';

const SUNFLOWER_TRACK = {
  wrapperType: 'track',
  kind: 'song',
  trackId: 1445931937,
  trackName: 'Sunflower',
  artistName: 'Post Malone & Swae Lee',
  artworkUrl100: 'https://cdn.test/sunflower.jpg',
  previewUrl: 'https://cdn.test/sunflower.m4a',
};

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: () => Promise.resolve(response.body),
  } as Response);
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

describe('ItunesSongCatalog', () => {
  const catalog = new ItunesSongCatalog();

  afterEach(() => jest.restoreAllMocks());

  it('returns trending songs in chart order and caches them', async () => {
    const trendingCatalog = new ItunesSongCatalog();
    const secondTrack = { ...SUNFLOWER_TRACK, trackId: 222, trackName: 'Second' };
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      // Chart feed: 222 ranks above 1445931937.
      .mockResolvedValueOnce(jsonResponse({ feed: { results: [{ id: '222' }, { id: '1445931937' }] } }))
      // Lookup returns them in a different order.
      .mockResolvedValueOnce(jsonResponse({ results: [SUNFLOWER_TRACK, secondTrack] }));

    const first = await trendingCatalog.trending();
    const second = await trendingCatalog.trending();

    expect(first.map((song) => song.id)).toEqual(['222', '1445931937']);
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('maps song tracks and skips non-song rows', async () => {
    mockFetch({
      ok: true,
      body: { results: [SUNFLOWER_TRACK, { wrapperType: 'artist', artistName: 'Post Malone' }] },
    });

    const songs = await catalog.search('sunflower', 10);

    expect(songs).toEqual([
      {
        id: '1445931937',
        title: 'Sunflower',
        artist: 'Post Malone & Swae Lee',
        artworkUrl: 'https://cdn.test/sunflower.jpg',
        previewUrl: 'https://cdn.test/sunflower.m4a',
      },
    ]);
  });

  it('returns null for an id that is not a track id, without calling iTunes', async () => {
    const fetchSpy = mockFetch({ ok: true, body: { results: [] } });

    await expect(catalog.findById('not-a-number')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when the lookup finds no matching song', async () => {
    mockFetch({ ok: true, body: { results: [] } });

    await expect(catalog.findById('123')).resolves.toBeNull();
  });

  it('throws SongCatalogUnavailableError when iTunes responds with an error', async () => {
    mockFetch({ ok: false, status: 503 });

    await expect(catalog.search('sunflower', 10)).rejects.toThrow(SongCatalogUnavailableError);
  });
});
