import type { SupabaseClient } from '@supabase/supabase-js'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { YouTubeApiDiscoveryEngine } from '@/lib/discovery/youtube-api-engine'
import type { DiscoveredChannel } from '@/lib/discovery/types'
import { fetchOfficialUpdates } from './fetch-official-updates'
import { fetchNicheSignals } from './fetch-niche-signals'
import { generateDigestItems } from './generate-digest'
import { simplifyNicheQueries } from './simplify-niche-query'
import type { NewsItemDraft } from './generate-digest'
import type { NewsItemRow, OfficialUpdate } from './types'

const FRESHNESS_HOURS = 24
const RUNNING_LOCK_MINUTES = 5

export interface EnsureFreshDigestDeps {
  supabase: SupabaseClient
  userId: string
  niches: string[]
  fetchOfficialUpdates: () => Promise<OfficialUpdate[]>
  fetchNicheSignals: (
    niches: string[]
  ) => Promise<{ competencia: DiscoveredChannel[]; canalesNuevos: DiscoveredChannel[] }>
  generateDigestItems: (input: {
    officialUpdates: OfficialUpdate[]
    competencia: DiscoveredChannel[]
    canalesNuevos: DiscoveredChannel[]
  }) => Promise<NewsItemDraft[]>
  // Solo para tests: el digest es compartido por todo el equipo por diseño
  // (una sola tabla, no por usuario), así que en producción `getDashboardNewsItems`
  // nunca pasa este campo y las queries siguen sin filtrar/globales como siempre.
  // Los tests lo usan para aislar sus lecturas a las filas que su propio usuario
  // efímero creó, evitando depender de estado global de la tabla remota compartida.
  scopeToCreatedBy?: string
}

export async function ensureFreshDigest(deps: EnsureFreshDigestDeps): Promise<NewsItemRow[]> {
  const { supabase, userId, niches, scopeToCreatedBy } = deps

  let lastCompletedQuery = supabase
    .from('news_digest_runs')
    .select('id, completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
  if (scopeToCreatedBy) lastCompletedQuery = lastCompletedQuery.eq('created_by', scopeToCreatedBy)
  const { data: lastCompleted } = await lastCompletedQuery.maybeSingle()

  if (lastCompleted?.completed_at) {
    const ageHours = (Date.now() - new Date(lastCompleted.completed_at).getTime()) / (1000 * 60 * 60)
    if (ageHours < FRESHNESS_HOURS) {
      return fetchItemsForRun(supabase, lastCompleted.id)
    }
  }

  const lockCutoff = new Date(Date.now() - RUNNING_LOCK_MINUTES * 60 * 1000).toISOString()
  let activeRunQuery = supabase
    .from('news_digest_runs')
    .select('id')
    .eq('status', 'running')
    .gte('created_at', lockCutoff)
    .limit(1)
  if (scopeToCreatedBy) activeRunQuery = activeRunQuery.eq('created_by', scopeToCreatedBy)
  const { data: activeRun } = await activeRunQuery.maybeSingle()

  if (activeRun) {
    return lastCompleted ? fetchItemsForRun(supabase, lastCompleted.id) : []
  }

  const { data: newRun, error: insertError } = await supabase
    .from('news_digest_runs')
    .insert({ created_by: userId, status: 'running' })
    .select()
    .single()

  if (insertError || !newRun) {
    return lastCompleted ? fetchItemsForRun(supabase, lastCompleted.id) : []
  }

  try {
    const [officialUpdates, nicheSignals] = await Promise.all([
      deps.fetchOfficialUpdates(),
      deps.fetchNicheSignals(niches),
    ])

    const draftItems = await deps.generateDigestItems({
      officialUpdates,
      competencia: nicheSignals.competencia,
      canalesNuevos: nicheSignals.canalesNuevos,
    })

    if (draftItems.length > 0) {
      const { error: itemsError } = await supabase.from('news_items').insert(
        draftItems.map((item) => ({
          digest_run_id: newRun.id,
          category: item.category,
          title: item.title,
          summary: item.summary,
          source_url: item.source_url,
          source_channel_youtube_id: item.source_channel_youtube_id,
        }))
      )
      if (itemsError) throw new Error(itemsError.message)
    }

    await supabase
      .from('news_digest_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', newRun.id)

    return fetchItemsForRun(supabase, newRun.id)
  } catch (err) {
    await supabase
      .from('news_digest_runs')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', newRun.id)

    return lastCompleted ? fetchItemsForRun(supabase, lastCompleted.id) : []
  }
}

async function fetchItemsForRun(supabase: SupabaseClient, runId: string): Promise<NewsItemRow[]> {
  const { data } = await supabase
    .from('news_items')
    .select('id, category, title, summary, source_url, source_channel_youtube_id, created_at')
    .eq('digest_run_id', runId)
    .order('created_at', { ascending: true })
  return (data ?? []) as NewsItemRow[]
}

export async function getDashboardNewsItems(
  supabase: SupabaseClient,
  userId: string,
  niches: string[]
): Promise<NewsItemRow[]> {
  const apiKey = process.env.YOUTUBE_API_KEY!
  const engine = new YouTubeApiDiscoveryEngine(apiKey)

  return ensureFreshDigest({
    supabase,
    userId,
    niches,
    fetchOfficialUpdates: () => fetchOfficialUpdates(apiKey),
    // Las descripciones de nicho suelen ser oraciones largas y detalladas
    // (pensadas para prompts de generación de contenido), pero la búsqueda
    // de canales de YouTube casi no devuelve resultados con consultas tan
    // largas — se simplifican a una consulta corta antes de buscar.
    fetchNicheSignals: async (n) => fetchNicheSignals(engine, await simplifyNicheQueries(createAnthropicClient(), n)),
    generateDigestItems: (input) => generateDigestItems(createAnthropicClient(), input),
  })
}
