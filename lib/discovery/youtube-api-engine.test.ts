import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YouTubeApiDiscoveryEngine } from './youtube-api-engine'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('YouTubeApiDiscoveryEngine', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca canales, los hidrata y calcula el puntaje de monetización', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    // 1. search.list -> un canal candidato
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: { channelId: 'UC_abc' }, snippet: { title: 'Canal Abc', publishedAt: '2026-06-01T00:00:00Z' } }] })
    )
    // 2. channels.list -> stats + uploads playlist
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            id: 'UC_abc',
            statistics: { subscriberCount: '3000' },
            contentDetails: { relatedPlaylists: { uploads: 'UU_abc' } },
          },
        ],
      })
    )
    // 3. playlistItems.list -> ids de videos recientes
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-20T00:00:00Z' } },
          { contentDetails: { videoId: 'v2', videoPublishedAt: '2026-08-10T00:00:00Z' } },
        ],
      })
    )
    // 4. videos.list -> stats + duración de esos videos
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', statistics: { viewCount: '4000' }, contentDetails: { duration: 'PT45S' } },
          { id: 'v2', statistics: { viewCount: '6000' }, contentDetails: { duration: 'PT8M0S' } },
        ],
      })
    )

    const engine = new YouTubeApiDiscoveryEngine('fake-api-key')
    const results = await engine.searchChannels({
      query: 'finanzas personales',
      maxAgeDays: 90,
      maxSubscribers: 100000,
      minAvgViews: 1000,
    })

    expect(results).toHaveLength(1)
    expect(results[0].youtubeChannelId).toBe('UC_abc')
    expect(results[0].subscriberCount).toBe(3000)
    expect(results[0].recentVideoCount).toBe(2)
    expect(results[0].avgRecentViews).toBe(5000)
    expect(results[0].shortsRatio).toBe(0.5)
    expect(results[0].monetizationScore).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('descarta canales sin uploads playlist en vez de lanzar una excepción', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: { channelId: 'UC_empty' }, snippet: { title: 'Vacío', publishedAt: '2026-06-01T00:00:00Z' } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_empty', statistics: {}, contentDetails: { relatedPlaylists: {} } }] })
    )

    const engine = new YouTubeApiDiscoveryEngine('fake-api-key')
    const results = await engine.searchChannels({
      query: 'finanzas personales',
      maxAgeDays: 90,
      maxSubscribers: 100000,
      minAvgViews: 1000,
    })

    expect(results).toHaveLength(0)
  })
})
