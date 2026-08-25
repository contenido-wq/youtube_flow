import { describe, it, expect } from 'vitest'
import { generateClonePlanItems } from './clone-plan-generator'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('generateClonePlanItems', () => {
  const baseInput = {
    channelNiche: 'finanzas personales',
    channelVariationRules: 'Variar el ángulo del hook y los ejemplos en cada video.',
    outlierVideos: [
      { title: 'Cómo ahorrar tu primer millón', viewCount: 500000 },
      { title: '5 errores que te mantienen pobre', viewCount: 300000 },
    ],
  }

  it('parsea la respuesta JSON de Claude en items de plan de clonación', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify([
        { sourceVideoTitle: 'Cómo ahorrar tu primer millón', proposedTopic: 'El primer millón: mitos y realidades', proposedAngle: 'Enfoque en mitos comunes en vez de pasos' },
      ])
    )

    const items = await generateClonePlanItems(client, baseInput)

    expect(items).toHaveLength(1)
    expect(items[0].sourceVideoTitle).toBe('Cómo ahorrar tu primer millón')
    expect(items[0].proposedTopic).toBe('El primer millón: mitos y realidades')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('esto no es JSON')

    await expect(generateClonePlanItems(client, baseInput)).rejects.toThrow(/JSON/)
  })
})
