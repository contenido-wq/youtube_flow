import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface SuggestChannelProfileInput {
  channelTitle: string
  channelDescription: string
}

export interface SuggestedChannelProfile {
  niche: string
  variationRules: string
}

export async function suggestChannelProfile(
  client: AnthropicMessagesClient,
  input: SuggestChannelProfileInput
): Promise<SuggestedChannelProfile> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      'A partir del título y la descripción de un canal de YouTube, sugiere (1) un nicho corto y ' +
      'específico, y (2) reglas de variación concretas y accionables para producir videos similares ' +
      'sin caer en contenido templado sin variación creativa (la política "Inauthentic Content" de ' +
      'YouTube penaliza justamente eso). Responde ÚNICAMENTE con un objeto JSON válido, sin texto ' +
      'adicional, con el formato: {"niche": string, "variationRules": string}',
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
