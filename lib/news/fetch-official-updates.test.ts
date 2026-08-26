import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOfficialUpdates } from './fetch-official-updates'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('fetchOfficialUpdates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resuelve el handle, trae la playlist de uploads y filtra a los últimos 7 días', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const now = Date.now()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 1. resolveChannelFromUrl -> lookupChannel (forHandle) resuelve directo
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_official', snippet: { title: 'Canal Oficial de Prueba' } }] })
    )
    // 2. channels.list (contentDetails) -> uploads playlist
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_official' } } }] })
    )
    // 3. playlistItems.list (snippet) -> uno reciente, uno viejo
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            snippet: {
              title: 'Nueva función de YouTube',
              description: 'Descripción de la función.',
              publishedAt: recent,
              resourceId: { videoId: 'v_recent' },
            },
          },
          {
            snippet: {
              title: 'Video viejo',
              description: 'Ya no es relevante.',
              publishedAt: old,
              resourceId: { videoId: 'v_old' },
            },
          },
        ],
      })
    )

    const updates = await fetchOfficialUpdates('fake-key', ['@CanalPrueba'])

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      channelName: 'Canal Oficial de Prueba',
      videoId: 'v_recent',
      title: 'Nueva función de YouTube',
      description: 'Descripción de la función.',
      publishedAt: recent,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('sigue con los demás handles si uno no se puede resolver', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    // Handle 1: no se encuentra ni por lookup directo (forHandle) ni por el
    // fallback de búsqueda por nombre que hace resolveChannelFromUrl.
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [] }))
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [] }))
    // Handle 2: se resuelve pero no tiene uploads playlist
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [{ id: 'UC_2', snippet: { title: 'Canal 2' } }] }))
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [{ contentDetails: {} }] }))

    const updates = await fetchOfficialUpdates('fake-key', ['@NoExiste', '@SinPlaylist'])

    expect(updates).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('sigue con los demás handles si playlistItems.list falla para uno (p.ej. una playlist de uploads inválida)', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const now = Date.now()
    const recent = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()

    // Handle 1 (@SinUploads): se resuelve, tiene playlist, pero playlistItems.list falla
    // (caso real: @TeamYouTube devuelve un uploads playlist id que YouTube rechaza porque
    // el canal casi no sube videos).
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_1', snippet: { title: 'Canal Sin Uploads' } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_invalida' } } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ error: { message: "The playlist identified with the request's playlistId parameter cannot be found." } })
    )
    // Handle 2 (@CanalBueno): funciona normal
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_2', snippet: { title: 'Canal Bueno' } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_2' } } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            snippet: {
              title: 'Anuncio real',
              description: 'Descripción.',
              publishedAt: recent,
              resourceId: { videoId: 'v_ok' },
            },
          },
        ],
      })
    )

    const updates = await fetchOfficialUpdates('fake-key', ['@SinUploads', '@CanalBueno'])

    expect(updates).toHaveLength(1)
    expect(updates[0].channelName).toBe('Canal Bueno')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})
