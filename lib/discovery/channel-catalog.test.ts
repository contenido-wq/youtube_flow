import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getChannelCatalog } from './channel-catalog'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('getChannelCatalog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pagina playlistItems hasta agotar nextPageToken o maxPages, luego hidrata con videos.list', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    // 1. channels.list -> uploads playlist
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_x' } } }] })
    )
    // 2. playlistItems.list página 1 (con nextPageToken)
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        nextPageToken: 'PAGE2',
        items: [{ contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-01T00:00:00Z' } }],
      })
    )
    // 3. playlistItems.list página 2 (sin nextPageToken)
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [{ contentDetails: { videoId: 'v2', videoPublishedAt: '2026-07-01T00:00:00Z' } }],
      })
    )
    // 4. videos.list para v1 + v2
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', snippet: { title: 'Video 1' }, statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
          { id: 'v2', snippet: { title: 'Video 2' }, statistics: { viewCount: '2000' }, contentDetails: { duration: 'PT3M' } },
        ],
      })
    )

    const catalog = await getChannelCatalog('fake-key', 'UC_x')

    expect(catalog).toHaveLength(2)
    expect(catalog[0]).toEqual({
      videoId: 'v1',
      title: 'Video 1',
      publishedAt: '2026-08-01T00:00:00Z',
      viewCount: 1000,
      durationSeconds: 300,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('respeta maxPages aunque haya más páginas disponibles', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_x' } } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        nextPageToken: 'PAGE2',
        items: [{ contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-01T00:00:00Z' } }],
      })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', snippet: { title: 'Video 1' }, statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
        ],
      })
    )

    const catalog = await getChannelCatalog('fake-key', 'UC_x', 1)

    expect(catalog).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3) // channels.list + 1 página de playlistItems + videos.list, sin página 2
  })

  it('divide videos.list en lotes de máximo 50 ids (la API de YouTube rechaza más con error 400)', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    const page1Items = Array.from({ length: 50 }, (_, i) => ({
      contentDetails: { videoId: `v${i + 1}`, videoPublishedAt: '2026-08-01T00:00:00Z' },
    }))
    const page2Items = Array.from({ length: 30 }, (_, i) => ({
      contentDetails: { videoId: `v${i + 51}`, videoPublishedAt: '2026-07-01T00:00:00Z' },
    }))

    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_x' } } }] })
    )
    fetchMock.mockImplementationOnce(() => jsonResponse({ nextPageToken: 'PAGE2', items: page1Items }))
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: page2Items }))

    // videos.list debe llamarse dos veces: una por cada lote de <=50 ids.
    fetchMock.mockImplementationOnce((input: string) => {
      const idsParam = new URL(input).searchParams.get('id')!
      const ids = idsParam.split(',')
      expect(ids.length).toBeLessThanOrEqual(50)
      return jsonResponse({
        items: ids.map((id) => ({
          id,
          snippet: { title: `Título ${id}` },
          statistics: { viewCount: '100' },
          contentDetails: { duration: 'PT1M' },
        })),
      })
    })
    fetchMock.mockImplementationOnce((input: string) => {
      const idsParam = new URL(input).searchParams.get('id')!
      const ids = idsParam.split(',')
      expect(ids.length).toBeLessThanOrEqual(50)
      return jsonResponse({
        items: ids.map((id) => ({
          id,
          snippet: { title: `Título ${id}` },
          statistics: { viewCount: '100' },
          contentDetails: { duration: 'PT1M' },
        })),
      })
    })

    const catalog = await getChannelCatalog('fake-key', 'UC_x')

    expect(catalog).toHaveLength(80)
    expect(fetchMock).toHaveBeenCalledTimes(5) // channels.list + 2 páginas playlistItems + 2 lotes videos.list
  })
})
