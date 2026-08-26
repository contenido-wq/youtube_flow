import { parseISO8601Duration } from './duration'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface CatalogVideo {
  videoId: string
  title: string
  publishedAt: string
  viewCount: number
  durationSeconds: number
}

export async function getChannelCatalog(
  apiKey: string,
  youtubeChannelId: string,
  maxPages: number = 4
): Promise<CatalogVideo[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(apiKey, youtubeChannelId)
  if (!uploadsPlaylistId) return []

  const videoRefs: { videoId: string; publishedAt: string }[] = []
  let pageToken: string | undefined
  let pagesFetched = 0

  do {
    const page = await getPlaylistPage(apiKey, uploadsPlaylistId, pageToken)
    videoRefs.push(...page.items)
    pageToken = page.nextPageToken
    pagesFetched += 1
  } while (pageToken && pagesFetched < maxPages)

  if (videoRefs.length === 0) return []

  const stats = await getVideoDetails(apiKey, videoRefs.map((v) => v.videoId))
  const publishedAtByVideoId = new Map(videoRefs.map((v) => [v.videoId, v.publishedAt]))

  return stats.map((s) => ({
    videoId: s.videoId,
    title: s.title,
    publishedAt: publishedAtByVideoId.get(s.videoId) ?? '',
    viewCount: s.viewCount,
    durationSeconds: s.durationSeconds,
  }))
}

async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string | undefined> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.error) {
    throw new Error(`channels.list falló: ${data.error.message ?? JSON.stringify(data.error)}`)
  }

  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getPlaylistPage(
  apiKey: string,
  playlistId: string,
  pageToken: string | undefined
): Promise<{ items: { videoId: string; publishedAt: string }[]; nextPageToken: string | undefined }> {
  const url = new URL(`${BASE_URL}/playlistItems`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('key', apiKey)
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.error) {
    throw new Error(`playlistItems.list falló: ${data.error.message ?? JSON.stringify(data.error)}`)
  }

  return {
    items: (data.items ?? []).map((item: { contentDetails: { videoId: string; videoPublishedAt: string } }) => ({
      videoId: item.contentDetails.videoId,
      publishedAt: item.contentDetails.videoPublishedAt,
    })),
    nextPageToken: data.nextPageToken,
  }
}

// videos.list rechaza con un 400 "invalid filter parameter" si el parámetro
// `id` trae más de 50 valores — hay que dividir en lotes de máximo 50.
const VIDEOS_LIST_BATCH_SIZE = 50

async function getVideoDetails(
  apiKey: string,
  videoIds: string[]
): Promise<{ videoId: string; title: string; viewCount: number; durationSeconds: number }[]> {
  const results: { videoId: string; title: string; viewCount: number; durationSeconds: number }[] = []

  for (let i = 0; i < videoIds.length; i += VIDEOS_LIST_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEOS_LIST_BATCH_SIZE)

    const url = new URL(`${BASE_URL}/videos`)
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.error) {
      throw new Error(`videos.list falló: ${data.error.message ?? JSON.stringify(data.error)}`)
    }

    results.push(
      ...(data.items ?? []).map(
        (item: {
          id: string
          snippet: { title: string }
          statistics: { viewCount?: string }
          contentDetails: { duration: string }
        }) => ({
          videoId: item.id,
          title: item.snippet.title,
          viewCount: Number(item.statistics.viewCount ?? 0),
          durationSeconds: parseISO8601Duration(item.contentDetails.duration),
        })
      )
    )
  }

  return results
}
