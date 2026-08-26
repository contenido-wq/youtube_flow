'use server'

import { createClient } from '@/lib/supabase/server'
import { channelSchema, type ChannelInput } from '@/lib/channels/schema'
import { resolveChannelFromUrl } from '@/lib/discovery/resolve-channel-url'
import { fetchChannelDetails } from '@/lib/discovery/fetch-channel-details'
import { getChannelCatalog } from '@/lib/discovery/channel-catalog'
import { summarizeCloneMetrics } from '@/lib/discovery/clone-metrics'
import { suggestChannelProfile } from '@/lib/channels/suggest-channel-profile'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface CloneMetricsResult {
  subscriberCount: number
  viewCount: number
  videoCount: number
  uploadCadencePerWeek: number
  avgViews: number
  topOutlier: { title: string; viewCount: number } | null
}

interface PrefillChannelResult {
  error: string | null
  name: string
  originalChannelTitle: string
  target_country: string
  target_language: string
  niche: string
  variation_rules: string
  brand_voice_id: string
  visual_style_reference: string
  metrics: CloneMetricsResult | null
}

// Server Actions don't preserve discriminated unions cleanly across the
// server/client boundary — every branch returns the same shape (empty
// strings on failure) so callers never have to deal with possibly-undefined
// fields depending on which branch ran.
const EMPTY_PREFILL = {
  name: '',
  originalChannelTitle: '',
  target_country: '',
  target_language: '',
  niche: '',
  variation_rules: '',
  brand_voice_id: '',
  visual_style_reference: '',
  metrics: null,
}

export async function prefillChannelFromUrl(url: string): Promise<PrefillChannelResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', ...EMPTY_PREFILL }

  const resolved = await resolveChannelFromUrl(process.env.YOUTUBE_API_KEY!, url)
  if (!resolved) return { error: 'No se pudo encontrar ese canal de YouTube — revisa la URL', ...EMPTY_PREFILL }

  try {
    const [details, catalog] = await Promise.all([
      fetchChannelDetails(process.env.YOUTUBE_API_KEY!, resolved.channelId),
      getChannelCatalog(process.env.YOUTUBE_API_KEY!, resolved.channelId),
    ])

    const cloneMetrics = summarizeCloneMetrics(catalog)

    const anthropic = createAnthropicClient()
    const suggestion = await suggestChannelProfile(anthropic, {
      channelTitle: resolved.title,
      channelDescription: details.description,
    })

    return {
      error: null,
      name: suggestion.suggestedName,
      originalChannelTitle: resolved.title,
      target_country: details.country ?? '',
      target_language: details.defaultLanguage?.slice(0, 2) ?? '',
      niche: suggestion.niche,
      variation_rules: suggestion.variationRules,
      brand_voice_id: suggestion.brandVoice,
      visual_style_reference: suggestion.visualStyleReference,
      metrics: {
        subscriberCount: details.subscriberCount,
        viewCount: details.viewCount,
        videoCount: details.videoCount,
        uploadCadencePerWeek: cloneMetrics.uploadCadencePerWeek,
        avgViews: cloneMetrics.avgViews,
        topOutlier: cloneMetrics.topOutlier,
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error desconocido autocompletando el canal', ...EMPTY_PREFILL }
  }
}

export async function createChannel(input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('channels').insert({ ...parsed.data, created_by: user.id })
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}

export async function updateChannel(id: string, input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('channels').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}
