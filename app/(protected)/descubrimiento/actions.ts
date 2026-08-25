'use server'

import { createClient } from '@/lib/supabase/server'
import { YouTubeApiDiscoveryEngine } from '@/lib/discovery/youtube-api-engine'
import type { ChannelSearchFilters } from '@/lib/discovery/types'
import { redirect } from 'next/navigation'

export async function runDiscovery(filters: ChannelSearchFilters) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { runId: null, error: 'No autenticado' }

  const { data: run, error: runError } = await supabase
    .from('discovery_runs')
    .insert({ created_by: user.id, filters, status: 'running' })
    .select()
    .single()

  if (runError || !run) return { runId: null, error: runError?.message ?? 'Error creando el run' }

  try {
    const engine = new YouTubeApiDiscoveryEngine(process.env.YOUTUBE_API_KEY!)
    const results = await engine.searchChannels(filters)

    if (results.length > 0) {
      const { error: resultsError } = await supabase.from('discovery_results').insert(
        results.map((r) => ({
          discovery_run_id: run.id,
          youtube_channel_id: r.youtubeChannelId,
          channel_title: r.channelTitle,
          channel_published_at: r.channelPublishedAt,
          subscriber_count: r.subscriberCount,
          recent_video_count: r.recentVideoCount,
          avg_recent_views: r.avgRecentViews,
          shorts_ratio: r.shortsRatio,
          upload_velocity_per_week: r.uploadVelocityPerWeek,
          monetization_score: r.monetizationScore,
        }))
      )
      if (resultsError) throw new Error(resultsError.message)
    }

    await supabase.from('discovery_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', run.id)
  } catch (err) {
    await supabase
      .from('discovery_runs')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', run.id)
    return { runId: run.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/descubrimiento/${run.id}`)
}
