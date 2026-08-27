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
  seoTitles: [
    'La VERDAD que nadie te dice sobre el ahorro',
    'Cómo llegué a mi primer millón (método real)',
    'El error que te mantiene pobre',
    'Nadie habla de esto en finanzas personales',
    'Así ahorré mi primer millón en un año',
    'El secreto que los bancos no te cuentan',
    'Por qué nunca logras ahorrar (y cómo arreglarlo)',
    'La estrategia que cambió mi relación con el dinero',
    'De cero a tu primer millón: el camino real',
    'Lo que aprendí ahorrando mi primer millón',
  ],
  seoDescription: 'Descripción optimizada.',
  seoTags: ['finanzas', 'ahorro'],
  seoPinnedComment: '¿Cuál de estos tips ya aplicas?',
  seoThumbnailPhrases: ['ESTO CAMBIA TODO', 'NADIE TE LO DIJO'],
  seoImagePrompts: [
    'Close-up dramático de una persona sorprendida mirando una calculadora, texto en MAYÚSCULAS: "ESTO CAMBIA TODO", fuente Impact, color white with black outline.',
    'Escena amplia de un escritorio desordenado con facturas, texto en MAYÚSCULAS: "NADIE TE LO DIJO", fuente Bebas Neue, color yellow with drop shadow.',
    'Composición conceptual de billetes formando una escalera hacia arriba, texto en MAYÚSCULAS: "TU PRIMER MILLÓN", fuente bold sans-serif, color gold with white stroke.',
    'Escena dinámica de una persona celebrando con los brazos en alto frente a una gráfica ascendente, texto en MAYÚSCULAS: "LO LOGRÉ", fuente 3D extruded, color gold with shadow.',
  ],
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
    expect(result.seoTitles).toHaveLength(10)
    expect(result.seoImagePrompts).toHaveLength(4)
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
