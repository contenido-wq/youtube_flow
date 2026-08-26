import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchChannelDetails } from './fetch-channel-details'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('fetchChannelDetails', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mapea snippet.description/country/defaultLanguage y statistics', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            snippet: {
              description: 'Un canal sobre finanzas personales.',
              country: 'CO',
              defaultLanguage: 'es-419',
            },
            statistics: {
              subscriberCount: '125000',
              viewCount: '48000000',
              videoCount: '340',
            },
          },
        ],
      })
    )

    const result = await fetchChannelDetails('fake-key', 'UC_x')

    expect(result).toEqual({
      description: 'Un canal sobre finanzas personales.',
      country: 'CO',
      defaultLanguage: 'es-419',
      subscriberCount: 125000,
      viewCount: 48000000,
      videoCount: 340,
    })
  })

  it('devuelve campos vacíos/undefined/0 si el canal no expone country/defaultLanguage/statistics', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ snippet: { description: 'Sin más datos.' } }] })
    )

    const result = await fetchChannelDetails('fake-key', 'UC_x')

    expect(result).toEqual({
      description: 'Sin más datos.',
      country: undefined,
      defaultLanguage: undefined,
      subscriberCount: 0,
      viewCount: 0,
      videoCount: 0,
    })
  })

  it('lanza un error descriptivo si la API falla', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ error: { message: 'quota exceeded' } }))

    await expect(fetchChannelDetails('fake-key', 'UC_x')).rejects.toThrow(/quota exceeded/)
  })
})
