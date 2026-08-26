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

  it('mapea snippet.description/country/defaultLanguage', async () => {
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
          },
        ],
      })
    )

    const result = await fetchChannelDetails('fake-key', 'UC_x')

    expect(result).toEqual({
      description: 'Un canal sobre finanzas personales.',
      country: 'CO',
      defaultLanguage: 'es-419',
    })
  })

  it('devuelve campos vacíos/undefined si el canal no expone country/defaultLanguage', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ snippet: { description: 'Sin más datos.' } }] })
    )

    const result = await fetchChannelDetails('fake-key', 'UC_x')

    expect(result).toEqual({ description: 'Sin más datos.', country: undefined, defaultLanguage: undefined })
  })

  it('lanza un error descriptivo si la API falla', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ error: { message: 'quota exceeded' } }))

    await expect(fetchChannelDetails('fake-key', 'UC_x')).rejects.toThrow(/quota exceeded/)
  })
})
