import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getKeywordData } from './keywords-everywhere-client'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('getKeywordData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mapea la respuesta de la API a KeywordData[]', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        data: [
          { keyword: 'ahorrar dinero', vol: 12000, cpc: { value: '0.85' }, competition: 0.4 },
        ],
      })
    )

    const result = await getKeywordData('fake-key', ['ahorrar dinero'])

    expect(result).toEqual([{ keyword: 'ahorrar dinero', volume: 12000, cpc: 0.85, competition: 0.4 }])
  })

  it('devuelve un array vacío si la API no trae datos', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ data: [] }))

    const result = await getKeywordData('fake-key', ['algo raro'])

    expect(result).toEqual([])
  })
})
