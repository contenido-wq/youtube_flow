'use server'

import { createClient } from '@/lib/supabase/server'
import { splitIntoCoherentBlocks } from '@/lib/scripts/block-splitter'
import { generateThumbnailImage } from '@/lib/thumbnails/generate-thumbnail-image'

export async function splitScript(scriptContent: string, targetBlockSize: number) {
  return splitIntoCoherentBlocks(scriptContent, targetBlockSize)
}

export async function generateThumbnail(videoId: string, prompt: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'No autenticado' }

  let base64Image: string
  try {
    base64Image = await generateThumbnailImage(process.env.GEMINI_API_KEY!, prompt)
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  const imageBytes = Buffer.from(base64Image, 'base64')
  const fileName = `${videoId}/${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('thumbnails')
    .upload(fileName, imageBytes, { contentType: 'image/png' })
  if (uploadError) return { url: null, error: uploadError.message }

  const { data: publicUrlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName)

  const { data: video } = await supabase.from('videos').select('thumbnail_urls').eq('id', videoId).single()
  const updatedUrls = [...(video?.thumbnail_urls ?? []), publicUrlData.publicUrl]

  const { error: updateError } = await supabase
    .from('videos')
    .update({ thumbnail_urls: updatedUrls })
    .eq('id', videoId)
  if (updateError) return { url: null, error: updateError.message }

  return { url: publicUrlData.publicUrl, error: null }
}
