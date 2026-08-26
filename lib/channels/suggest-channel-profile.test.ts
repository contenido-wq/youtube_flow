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

  it('parsea la respuesta JSON de Claude en nombre + nicho + reglas + voz + estilo', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify({
        suggestedName: 'Mente Sombra',
        niche: 'psicología oscura y persuasión',
        variationRules: 'Variar el autor citado y el ejemplo de apertura en cada video.',
        brandVoice: 'Directo, provocador, con autoridad — habla en segunda persona.',
        visualStyleReference: 'Contraste alto en rojo y negro, tipografía condensada en mayúsculas.',
      })
    )

    const result = await suggestChannelProfile(client, baseInput)

    expect(result.suggestedName).toBe('Mente Sombra')
    expect(result.niche).toBe('psicología oscura y persuasión')
    expect(result.variationRules).toContain('Variar')
    expect(result.brandVoice).toContain('Directo')
    expect(result.visualStyleReference).toContain('Contraste')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(suggestChannelProfile(client, baseInput)).rejects.toThrow(/JSON/)
  })

  it('pide suficientes tokens de salida para no truncar el JSON a mitad de camino', async () => {
    let capturedMaxTokens = 0
    const client = {
      messages: {
        create: async (params: { max_tokens: number }) => {
          capturedMaxTokens = params.max_tokens
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  suggestedName: 'x',
                  niche: 'x',
                  variationRules: 'y',
                  brandVoice: 'z',
                  visualStyleReference: 'w',
                }),
              },
            ],
          }
        },
      },
    }

    await suggestChannelProfile(client, baseInput)

    expect(capturedMaxTokens).toBeGreaterThanOrEqual(3072)
  })
})
