import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export async function simplifyNicheQueries(client: AnthropicMessagesClient, niches: string[]): Promise<string[]> {
  if (niches.length === 0) return []

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    // Temperatura baja: elegir una frase de búsqueda corta es casi mecánico,
    // no creativo — queremos la misma consulta (y por lo tanto resultados
    // consistentes de YouTube) entre corridas del digest para el mismo nicho.
    temperature: 0.2,
    system:
      'Convertís descripciones de nicho de canal de YouTube (a veces largas y detalladas) en una consulta de ' +
      'búsqueda corta (entre 2 y 4 palabras) que un usuario real escribiría en el buscador de YouTube para ' +
      'encontrar canales de ese nicho. Quitá detalles de formato/estilo (ej. "narrado con animación de ' +
      'monigotes en pizarra digital") y quedate con el tema central. Responde ÚNICAMENTE con un array JSON de ' +
      'strings, en el mismo orden y largo que las descripciones recibidas. Ejemplo de respuesta: ' +
      '["análisis de actualidad", "finanzas personales"]',
    messages: [{ role: 'user', content: niches.map((n, i) => `${i + 1}. ${n}`).join('\n') }],
  })

  const text = extractText(response.content)

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length === niches.length && parsed.every((q) => typeof q === 'string')) {
      return parsed
    }
  } catch {
    // Cae al fallback de abajo.
  }

  // Si Claude no devuelve la forma esperada, se sigue con las descripciones
  // originales — peor calidad de búsqueda, pero no rompe el digest.
  return niches
}
