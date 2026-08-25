import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'
import type { KeywordData } from '@/lib/keywords/keywords-everywhere-client'

export async function generateTitles(
  client: AnthropicMessagesClient,
  topic: string,
  keywordData: KeywordData[]
): Promise<string[]> {
  const keywordSummary = keywordData
    .map((k) => `- "${k.keyword}" (volumen: ${k.volume}, competencia: ${k.competition})`)
    .join('\n')

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      'Eres un experto en títulos de YouTube de alto CTR (curiosidad, contraste, 3-4 palabras clave ' +
      'máximo). Genera 5-10 títulos estratégicos para el tema dado, incorporando naturalmente las ' +
      'keywords de mayor volumen cuando encajen. Responde ÚNICAMENTE con un array JSON de strings.',
    messages: [
      {
        role: 'user',
        content: `Tema: ${topic}\n\nDatos de keywords:\n${keywordSummary || '(sin datos de keywords)'}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as string[]
  } catch {
    throw new Error(`Claude no devolvió JSON válido para los títulos: ${text.slice(0, 200)}`)
  }
}
