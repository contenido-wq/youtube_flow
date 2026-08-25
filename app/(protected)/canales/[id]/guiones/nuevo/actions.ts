'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { estimateTargetCharacterCount } from '@/lib/scripts/duration-estimate'
import { generateScript } from '@/lib/scripts/generate-script'
import { redirect } from 'next/navigation'

export async function createVideo(
  channelId: string,
  input: {
    topic: string
    targetDurationSeconds: number
    style: 'estandar' | 'personalizado'
    referenceTranscript?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { videoId: null, error: 'No autenticado' }

  const { data: channel } = await supabase
    .from('channels')
    .select('niche, variation_rules, target_language, brand_voice_id')
    .eq('id', channelId)
    .single()
  if (!channel) return { videoId: null, error: 'Canal no encontrado' }

  const { data: calibration } = await supabase
    .from('voice_pace_calibration')
    .select('chars_per_minute')
    .eq('brand_voice_id', channel.brand_voice_id ?? 'default')
    .eq('target_language', channel.target_language)
    .maybeSingle()

  const { data: fallbackCalibration } = await supabase
    .from('voice_pace_calibration')
    .select('chars_per_minute')
    .eq('brand_voice_id', 'default')
    .eq('target_language', 'default')
    .single()

  const charsPerMinute = calibration?.chars_per_minute ?? fallbackCalibration!.chars_per_minute

  const targetCharacterCount = estimateTargetCharacterCount({
    targetDurationSeconds: input.targetDurationSeconds,
    charsPerMinute,
  })

  const { data: video, error: insertError } = await supabase
    .from('videos')
    .insert({
      channel_id: channelId,
      topic: input.topic,
      target_duration_seconds: input.targetDurationSeconds,
      target_character_count: targetCharacterCount,
      style: input.style,
      reference_transcript: input.referenceTranscript,
      status: 'generating',
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError || !video) return { videoId: null, error: insertError?.message ?? 'Error creando el video' }

  try {
    const anthropic = createAnthropicClient()
    const result = await generateScript(anthropic, {
      topic: input.topic,
      channelNiche: channel.niche,
      channelVariationRules: channel.variation_rules,
      targetLanguage: channel.target_language,
      targetCharacterCount,
      style: input.style,
      referenceTranscript: input.referenceTranscript,
    })

    await supabase
      .from('videos')
      .update({
        status: 'scripted',
        script_content: result.scriptContent,
        seo_description: result.seoDescription,
        seo_tags: result.seoTags,
        seo_pinned_comment: result.seoPinnedComment,
        seo_thumbnail_phrases: result.seoThumbnailPhrases,
        seo_image_prompt: result.seoImagePrompt,
      })
      .eq('id', video.id)
  } catch (err) {
    await supabase
      .from('videos')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', video.id)
    return { videoId: video.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/canales/${channelId}/guiones/${video.id}`)
}
