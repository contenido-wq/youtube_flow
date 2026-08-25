'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { getChannelCatalog } from '@/lib/discovery/channel-catalog'
import { calculateUploadCadence, findOutlierVideos } from '@/lib/discovery/clone-analysis'
import { generateClonePlanItems } from '@/lib/discovery/clone-plan-generator'
import { redirect } from 'next/navigation'

export async function runClonePlan(channelId: string, sourceYoutubeChannelId: string, sourceChannelTitle: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { planId: null, error: 'No autenticado' }

  const { data: channel } = await supabase.from('channels').select('niche, variation_rules').eq('id', channelId).single()
  if (!channel) return { planId: null, error: 'Canal no encontrado' }

  const catalog = await getChannelCatalog(process.env.YOUTUBE_API_KEY!, sourceYoutubeChannelId)
  const cadence = calculateUploadCadence(catalog)
  const avgDuration = catalog.reduce((sum, v) => sum + v.durationSeconds, 0) / (catalog.length || 1)
  const outliers = findOutlierVideos(catalog)

  const { data: plan, error: planError } = await supabase
    .from('channel_clone_plans')
    .insert({
      channel_id: channelId,
      source_youtube_channel_id: sourceYoutubeChannelId,
      source_channel_title: sourceChannelTitle,
      analyzed_video_count: catalog.length,
      upload_cadence_per_week: cadence,
      avg_duration_seconds: avgDuration,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (planError || !plan) return { planId: null, error: planError?.message ?? 'Error creando el plan' }

  try {
    const anthropic = createAnthropicClient()
    const items = await generateClonePlanItems(anthropic, {
      channelNiche: channel.niche,
      channelVariationRules: channel.variation_rules,
      outlierVideos: outliers,
    })

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('clone_plan_items').insert(
        items.map((item, index) => ({
          clone_plan_id: plan.id,
          source_video_title: item.sourceVideoTitle,
          source_video_views: outliers[index]?.viewCount ?? 0,
          proposed_topic: item.proposedTopic,
          proposed_angle: item.proposedAngle,
        }))
      )
      if (itemsError) throw new Error(itemsError.message)
    }

    await supabase.from('channel_clone_plans').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', plan.id)
  } catch (err) {
    await supabase
      .from('channel_clone_plans')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', plan.id)
    return { planId: plan.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/canales/${channelId}/clonar?planId=${plan.id}`)
}
