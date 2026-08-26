import type { SupabaseClient } from '@supabase/supabase-js'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { YouTubeApiDiscoveryEngine } from '@/lib/discovery/youtube-api-engine'
import type { DiscoveredChannel } from '@/lib/discovery/types'
import { fetchOfficialUpdates } from './fetch-official-updates'
import { fetchNicheSignals } from './fetch-niche-signals'
import { generateDigestItems } from './generate-digest'
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
}

export async function ensureFreshDigest(deps: EnsureFreshDigestDeps): Promise<NewsItemRow[]> {
  const { supabase, userId, niches } = deps

  const { data: lastCompleted } = await supabase
    .from('news_digest_runs')
    .select('id, completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastCompleted?.completed_at) {
    const ageHours = (Date.now() - new Date(lastCompleted.completed_at).getTime()) / (1000 * 60 * 60)
    if (ageHours < FRESHNESS_HOURS) {
      return fetchItemsForRun(supabase, lastCompleted.id)
    }
  }

  const lockCutoff = new Date(Date.now() - RUNNING_LOCK_MINUTES * 60 * 1000).toISOString()
  const { data: activeRun } = await supabase
    .from('news_digest_runs')
    .select('id')
    .eq('status', 'running')
    .gte('created_at', lockCutoff)
    .limit(1)
    .maybeSingle()

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
  const anthropic = createAnthropicClient()

  return ensureFreshDigest({
    supabase,
    userId,
    niches,
    fetchOfficialUpdates: () => fetchOfficialUpdates(apiKey),
    fetchNicheSignals: (n) => fetchNicheSignals(engine, n),
    generateDigestItems: (input) => generateDigestItems(anthropic, input),
  })
}
