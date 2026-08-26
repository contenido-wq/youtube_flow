import { describe, it, expect } from 'vitest'
import { generateDigestItems } from './generate-digest'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('generateDigestItems', () => {
  const baseInput = {
    officialUpdates: [
      {
        channelName: 'Creator Insider',
        videoId: 'v1',
        title: 'YouTube cambia el algoritmo de Shorts',
        description: 'Detalles del cambio.',
        publishedAt: '2026-08-20T00:00:00Z',
      },
    ],
    competencia: [],
    canalesNuevos: [],
  }

  it('parsea la respuesta JSON de Claude en items del digest', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify({
        items: [
          {
            category: 'oficial',
            title: 'Nuevo algoritmo de Shorts',
            summary: 'YouTube prioriza retención sobre duración. Ajusta tus primeros 3 segundos.',
            source_url: 'https://youtube.com/watch?v=v1',
            source_channel_youtube_id: null,
          },
        ],
      })
    )

    const items = await generateDigestItems(client, baseInput)

    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('oficial')
    expect(items[0].title).toBe('Nuevo algoritmo de Shorts')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('esto no es JSON')

    await expect(generateDigestItems(client, baseInput)).rejects.toThrow(/JSON/)
  })

  it('lanza un error descriptivo si el JSON no cumple el schema (category inválida)', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify({ items: [{ category: 'no_existe', title: 'x', summary: 'y', source_url: null, source_channel_youtube_id: null }] })
    )

    await expect(generateDigestItems(client, baseInput)).rejects.toThrow(/forma inválida/)
  })
})
