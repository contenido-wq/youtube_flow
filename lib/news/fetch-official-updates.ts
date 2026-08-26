import { resolveChannelFromUrl } from '@/lib/discovery/resolve-channel-url'
import { OFFICIAL_CHANNEL_HANDLES } from './official-sources'
import type { OfficialUpdate } from './types'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'
const LOOKBACK_DAYS = 7

export async function fetchOfficialUpdates(
  apiKey: string,
  handles: string[] = OFFICIAL_CHANNEL_HANDLES
): Promise<OfficialUpdate[]> {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  const updates: OfficialUpdate[] = []

  for (const handle of handles) {
    const resolved = await resolveChannelFromUrl(apiKey, handle)
    if (!resolved) continue

    const uploadsPlaylistId = await getUploadsPlaylistId(apiKey, resolved.channelId)
    if (!uploadsPlaylistId) continue

    const items = await getRecentPlaylistItems(apiKey, uploadsPlaylistId)
    for (const item of items) {
      if (new Date(item.publishedAt).getTime() < cutoff) continue
      updates.push({
        channelName: resolved.title,
        videoId: item.videoId,
        title: item.title,
        description: item.description,
        publishedAt: item.publishedAt,
      })
    }
  }

  return updates
}

async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string | undefined> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getRecentPlaylistItems(
  apiKey: string,
  playlistId: string
): Promise<{ videoId: string; title: string; description: string; publishedAt: string }[]> {
  const url = new URL(`${BASE_URL}/playlistItems`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  return (data.items ?? []).map(
    (item: {
      snippet: { title: string; description: string; publishedAt: string; resourceId: { videoId: string } }
    }) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
    })
  )
}
