import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateThumbnailImage } from './generate-thumbnail-image'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('generateThumbnailImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extrae el base64 de inlineData de la respuesta de Gemini', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: 'ZmFrZS1pbWFnZS1ieXRlcw==' } }],
            },
          },
        ],
      })
    )

    const result = await generateThumbnailImage('fake-key', 'Persona sorprendida mirando una calculadora')

    expect(result).toBe('ZmFrZS1pbWFnZS1ieXRlcw==')
  })

  it('lanza un error descriptivo si la API falla', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ error: { message: 'invalid api key' } }))

    await expect(generateThumbnailImage('fake-key', 'prompt')).rejects.toThrow(/invalid api key/)
  })

  it('lanza un error descriptivo si la respuesta no trae ninguna imagen', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'no puedo generar esa imagen' }] } }] })
    )

    await expect(generateThumbnailImage('fake-key', 'prompt')).rejects.toThrow(/no devolvió una imagen/)
  })
})
