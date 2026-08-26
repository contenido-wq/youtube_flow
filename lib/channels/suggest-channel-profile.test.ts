import { describe, it, expect } from 'vitest'
import { suggestChannelProfile } from './suggest-channel-profile'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('suggestChannelProfile', () => {
  const baseInput = {
    channelTitle: 'Dark Psychology',
    channelDescription: 'Consejos de psicología oscura y persuasión basados en Robert Greene.',
  }

  it('parsea la respuesta JSON de Claude en nicho + reglas de variación', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify({
        niche: 'psicología oscura y persuasión',
        variationRules: 'Variar el autor citado y el ejemplo de apertura en cada video.',
      })
    )

    const result = await suggestChannelProfile(client, baseInput)

    expect(result.niche).toBe('psicología oscura y persuasión')
    expect(result.variationRules).toContain('Variar')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(suggestChannelProfile(client, baseInput)).rejects.toThrow(/JSON/)
  })
})
