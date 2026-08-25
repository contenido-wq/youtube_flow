import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface GenerateScriptInput {
  topic: string
  channelNiche: string
  channelVariationRules: string
  targetLanguage: string
  targetCharacterCount: number
  style: 'estandar' | 'personalizado'
  referenceTranscript?: string
}

export interface GeneratedScript {
  scriptContent: string
  seoDescription: string
  seoTags: string[]
  seoPinnedComment: string
  seoThumbnailPhrases: string[]
  seoImagePrompt: string
}

export async function generateScript(
  client: AnthropicMessagesClient,
  input: GenerateScriptInput
): Promise<GeneratedScript> {
  const styleInstruction =
    input.style === 'personalizado' && input.referenceTranscript
      ? `Estilo personalizado: analiza el patrón estructural y narrativo (ritmo, tipo de apertura, forma de cerrar ideas) de esta transcripción de referencia y replica ESE PATRÓN — nunca copies su texto literal:\n\n"""${input.referenceTranscript}"""`
      : 'Estilo estándar: usa una estructura de hook (0-15s) + payoff cada 60-90s + CTA final.'

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system:
      'Eres un guionista para un canal de YouTube faceless. Escribes en el idioma indicado, respetando ' +
      'las reglas de variación del canal para evitar contenido templado sin variación creativa (riesgo de ' +
      'penalización por "Inauthentic Content"). Apunta al conteo de caracteres indicado — es mejor pasarte ' +
      'un poco que quedarte corto, prioriza siempre un cierre lógico del guion sobre cortar en seco al llegar ' +
      'al número exacto. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con el formato: ' +
      '{"scriptContent": string, "seoDescription": string, "seoTags": string[], "seoPinnedComment": string, ' +
      '"seoThumbnailPhrases": string[], "seoImagePrompt": string}',
    messages: [
      {
        role: 'user',
        content:
          `Tema: ${input.topic}\n` +
          `Nicho del canal: ${input.channelNiche}\n` +
          `Idioma de salida: ${input.targetLanguage}\n` +
          `Conteo de caracteres objetivo: ${input.targetCharacterCount}\n` +
          `Reglas de variación obligatoria: ${input.channelVariationRules}\n\n` +
          `${styleInstruction}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as GeneratedScript
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el guion: ${text.slice(0, 200)}`)
  }
}
