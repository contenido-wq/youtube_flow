import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface SuggestChannelProfileInput {
  channelTitle: string
  channelDescription: string
}

export interface SuggestedChannelProfile {
  suggestedName: string
  niche: string
  variationRules: string
  brandVoice: string
  visualStyleReference: string
}

export async function suggestChannelProfile(
  client: AnthropicMessagesClient,
  input: SuggestChannelProfileInput
): Promise<SuggestedChannelProfile> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3072,
    system:
      'A partir del título y la descripción de un canal de YouTube que el usuario quiere CLONAR ' +
      '(modelar su estilo, no copiarlo literalmente), sugiere: ' +
      '(1) suggestedName: un nombre de canal NUEVO y diferenciado — nunca el nombre original ni una ' +
      'variación trivial de él, ya que usar el mismo nombre de marca sería duplicar un canal existente; ' +
      '(2) niche: un nicho corto y específico; ' +
      '(3) variationRules: reglas de variación concretas y accionables para producir videos similares ' +
      'sin caer en contenido templado sin variación creativa (la política "Inauthentic Content" de ' +
      'YouTube penaliza justamente eso); ' +
      '(4) brandVoice: una descripción breve (1-2 frases) del tono y personalidad narrativa a usar; ' +
      '(5) visualStyleReference: una descripción breve (1-2 frases) del estilo visual recomendado ' +
      '(colores, tipografía, composición) para miniaturas y video. ' +
      'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con el formato: ' +
      '{"suggestedName": string, "niche": string, "variationRules": string, "brandVoice": string, ' +
      '"visualStyleReference": string}',
    messages: [
      {
        role: 'user',
        content: `Título del canal: ${input.channelTitle}\n\nDescripción: ${input.channelDescription}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as SuggestedChannelProfile
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el perfil sugerido: ${text.slice(0, 200)}`)
  }
}
