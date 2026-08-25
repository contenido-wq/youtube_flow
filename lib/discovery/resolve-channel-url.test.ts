import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveChannelFromUrl } from './resolve-channel-url'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('resolveChannelFromUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resuelve una URL con /channel/UC... directo por id', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_abc123', snippet: { title: 'Canal Directo' } }] })
    )

    const result = await resolveChannelFromUrl('fake-key', 'https://www.youtube.com/channel/UC_abc123')

    expect(result).toEqual({ channelId: 'UC_abc123', title: 'Canal Directo' })
    expect(fetchMock.mock.calls[0][0]).toContain('id=UC_abc123')
  })

  it('resuelve una URL con /@handle vía forHandle', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_handle', snippet: { title: 'Canal Handle' } }] })
    )

    const result = await resolveChannelFromUrl('fake-key', 'https://www.youtube.com/@MiCanal')

    expect(result).toEqual({ channelId: 'UC_handle', title: 'Canal Handle' })
    expect(fetchMock.mock.calls[0][0]).toContain('forHandle=%40MiCanal')
  })

  it('resuelve un @handle pegado suelto, sin URL completa', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_handle2', snippet: { title: 'Canal Suelto' } }] })
    )

    const result = await resolveChannelFromUrl('fake-key', '@MiCanal')

    expect(result).toEqual({ channelId: 'UC_handle2', title: 'Canal Suelto' })
  })

  it('resuelve una URL legacy /user/nombre vía forUsername', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_legacy', snippet: { title: 'Canal Legacy' } }] })
    )

    const result = await resolveChannelFromUrl('fake-key', 'https://www.youtube.com/user/canalviejo')

    expect(result).toEqual({ channelId: 'UC_legacy', title: 'Canal Legacy' })
    expect(fetchMock.mock.calls[0][0]).toContain('forUsername=canalviejo')
  })

  it('si el lookup por handle no encuentra nada, cae a búsqueda por nombre', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    // 1. forHandle no encuentra nada
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [] }))
    // 2. fallback: search.list encuentra el canal
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: { channelId: 'UC_found' }, snippet: { title: 'Canal Encontrado' } }] })
    )

    const result = await resolveChannelFromUrl('fake-key', 'https://www.youtube.com/c/NombrePersonalizado')

    expect(result).toEqual({ channelId: 'UC_found', title: 'Canal Encontrado' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('devuelve null para una URL que no es de un canal de YouTube', async () => {
    const result = await resolveChannelFromUrl('fake-key', 'https://example.com/algo')
    expect(result).toBeNull()
  })

  it('devuelve null si ningún lookup (ni el fallback de búsqueda) encuentra el canal', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [] }))
    fetchMock.mockImplementationOnce(() => jsonResponse({ items: [] }))

    const result = await resolveChannelFromUrl('fake-key', 'https://www.youtube.com/@NoExiste')

    expect(result).toBeNull()
  })
})
