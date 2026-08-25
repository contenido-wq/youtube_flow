import { describe, it, expect } from 'vitest'
import { generateTitles } from './generate-titles'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('generateTitles', () => {
  it('parsea la respuesta JSON de Claude en un array de títulos', async () => {
    const client = fakeAnthropicClient(JSON.stringify(['Cómo ahorrar tu primer millón (sin sacrificar tu vida)', '5 errores que te mantienen pobre']))

    const titles = await generateTitles(client, 'ahorro para principiantes', [
      { keyword: 'ahorrar dinero', volume: 12000, cpc: 0.85, competition: 0.4 },
    ])

    expect(titles).toHaveLength(2)
    expect(titles[0]).toContain('millón')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(generateTitles(client, 'tema', [])).rejects.toThrow(/JSON/)
  })
})
