import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface ClonePlanInput {
  channelNiche: string
  channelVariationRules: string
  outlierVideos: { title: string; viewCount: number }[]
}

export interface ClonePlanItem {
  sourceVideoTitle: string
  proposedTopic: string
  proposedAngle: string
}

export async function generateClonePlanItems(
  client: AnthropicMessagesClient,
  input: ClonePlanInput
): Promise<ClonePlanItem[]> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      'Eres un estratega de contenido para un canal de YouTube faceless. ' +
      'A partir de videos de mejor desempeño de OTRO canal en el mismo nicho, propones temas ' +
      'para el canal del usuario. NUNCA copies el guion o el texto literal — solo el tema y el ' +
      'ángulo estratégico. Cada tema propuesto debe respetar las reglas de variación del canal ' +
      'para evitar contenido templado sin variación creativa. Responde ÚNICAMENTE con un array ' +
      'JSON válido, sin texto adicional, con el formato: ' +
      '[{"sourceVideoTitle": string, "proposedTopic": string, "proposedAngle": string}]',
    messages: [
      {
        role: 'user',
        content:
          `Nicho del canal: ${input.channelNiche}\n` +
          `Reglas de variación obligatoria: ${input.channelVariationRules}\n\n` +
          `Videos de mejor desempeño del canal fuente:\n` +
          input.outlierVideos.map((v) => `- "${v.title}" (${v.viewCount} vistas)`).join('\n'),
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as ClonePlanItem[]
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el plan de clonación: ${text.slice(0, 200)}`)
  }
}
