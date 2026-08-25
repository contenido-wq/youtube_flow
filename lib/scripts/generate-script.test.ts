import { describe, it, expect } from 'vitest'
import { generateScript } from './generate-script'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

const fakeResponse = {
  scriptContent: 'Guion completo de ejemplo.',
  seoDescription: 'Descripción optimizada.',
  seoTags: ['finanzas', 'ahorro'],
  seoPinnedComment: '¿Cuál de estos tips ya aplicas?',
  seoThumbnailPhrases: ['ESTO CAMBIA TODO', 'NADIE TE LO DIJO'],
  seoImagePrompt: 'Persona sorprendida mirando una calculadora, estilo realista',
}

describe('generateScript', () => {
  const baseInput = {
    topic: 'Cómo ahorrar tu primer millón',
    channelNiche: 'finanzas personales',
    channelVariationRules: 'Variar el ángulo del hook y los ejemplos en cada video.',
    targetLanguage: 'es',
    targetCharacterCount: 6720,
    style: 'estandar' as const,
  }

  it('parsea la respuesta JSON de Claude en un guion + paquete SEO', async () => {
    const client = fakeAnthropicClient(JSON.stringify(fakeResponse))

    const result = await generateScript(client, baseInput)

    expect(result.scriptContent).toBe(fakeResponse.scriptContent)
    expect(result.seoTags).toEqual(fakeResponse.seoTags)
    expect(result.seoPinnedComment).toBe(fakeResponse.seoPinnedComment)
    expect(result.seoThumbnailPhrases).toHaveLength(2)
  })

  it('incluye la transcripción de referencia en el prompt cuando el estilo es personalizado', async () => {
    let capturedParams: unknown
    const client = {
      messages: {
        create: async (params: unknown) => {
          capturedParams = params
          return { content: [{ type: 'text', text: JSON.stringify(fakeResponse) }] }
        },
      },
    }

    await generateScript(client, {
      ...baseInput,
      style: 'personalizado',
      referenceTranscript: 'Transcripción de referencia de ejemplo.',
    })

    const serialized = JSON.stringify(capturedParams)
    expect(serialized).toContain('Transcripción de referencia de ejemplo.')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(generateScript(client, baseInput)).rejects.toThrow(/JSON/)
  })
})
