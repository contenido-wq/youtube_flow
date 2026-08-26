import { z } from 'zod'
import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'
import type { DiscoveredChannel } from '@/lib/discovery/types'
import type { OfficialUpdate } from './types'

const NewsItemDraftSchema = z.object({
  category: z.enum(['oficial', 'competencia', 'canales_nuevos', 'recomendacion']),
  title: z.string().min(1),
  summary: z.string().min(1),
  source_url: z.string().nullable(),
  source_channel_youtube_id: z.string().nullable(),
})

const DigestResponseSchema = z.object({ items: z.array(NewsItemDraftSchema) })

export type NewsItemDraft = z.infer<typeof NewsItemDraftSchema>

export interface DigestInput {
  officialUpdates: OfficialUpdate[]
  competencia: DiscoveredChannel[]
  canalesNuevos: DiscoveredChannel[]
}

export async function generateDigestItems(
  client: AnthropicMessagesClient,
  input: DigestInput
): Promise<NewsItemDraft[]> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      'Eres un estratega de contenido para un equipo que produce canales de YouTube faceless en español. ' +
      'A partir de señales crudas (uploads de canales oficiales de YouTube, y canales de la competencia/nuevos ' +
      'encontrados en los nichos del equipo), escribes un digest editorial corto y accionable — como un blog, ' +
      'no una lista de datos. Cada ítem debe tener un análisis y una recomendación concreta (qué tipo de canal, ' +
      'temática o formato de personaje vale la pena, o qué implica una actualización de YouTube para el equipo). ' +
      'Genera entre 1 y 3 ítems por categoría, máximo 10 en total. Si no hay señales suficientes para una ' +
      'categoría, omítela. Responde ÚNICAMENTE con JSON válido, sin texto adicional, con el formato: ' +
      '{"items": [{"category": "oficial" | "competencia" | "canales_nuevos" | "recomendacion", "title": string, ' +
      '"summary": string, "source_url": string | null, "source_channel_youtube_id": string | null}]}',
    messages: [{ role: 'user', content: buildPrompt(input) }],
  })

  const text = extractText(response.content)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el digest de noticias: ${text.slice(0, 200)}`)
  }

  const result = DigestResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Claude devolvió un digest con forma inválida: ${result.error.message}`)
  }

  return result.data.items
}

function buildPrompt(input: DigestInput): string {
  const officialSection = input.officialUpdates.length
    ? input.officialUpdates
        .map((u) => `- [${u.channelName}] "${u.title}" (video ${u.videoId}): ${u.description.slice(0, 300)}`)
        .join('\n')
    : '(sin novedades oficiales en los últimos 7 días)'

  const competenciaSection = input.competencia.length
    ? input.competencia
        .map(
          (c) =>
            `- ${c.channelTitle} (id ${c.youtubeChannelId}): ${c.subscriberCount ?? '?'} suscriptores, ` +
            `${c.uploadVelocityPerWeek.toFixed(1)} videos/semana, score ${c.monetizationScore.toFixed(2)}`
        )
        .join('\n')
    : '(sin canales de competencia encontrados)'

  const nuevosSection = input.canalesNuevos.length
    ? input.canalesNuevos
        .map(
          (c) =>
            `- ${c.channelTitle} (id ${c.youtubeChannelId}): ${c.subscriberCount ?? '?'} suscriptores, ` +
            `${c.uploadVelocityPerWeek.toFixed(1)} videos/semana, score ${c.monetizationScore.toFixed(2)}`
        )
        .join('\n')
    : '(sin canales nuevos encontrados)'

  return (
    `Novedades oficiales de YouTube (últimos 7 días):\n${officialSection}\n\n` +
    `Canales de competencia en los nichos del equipo:\n${competenciaSection}\n\n` +
    `Canales nuevos/creciendo rápido en los nichos del equipo:\n${nuevosSection}`
  )
}
