import { calculateMonetizationScore } from './scoring'
import { parseISO8601Duration, isShort } from './duration'
import type { ChannelSearchFilters, DiscoveredChannel, DiscoveryEngine } from './types'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export class YouTubeApiDiscoveryEngine implements DiscoveryEngine {
  constructor(private readonly apiKey: string) {}

  async searchChannels(filters: ChannelSearchFilters): Promise<DiscoveredChannel[]> {
    const publishedAfter = new Date(Date.now() - filters.maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

    // search.list: 100 unidades de cuota — se llama una sola vez por búsqueda.
    const candidates = await this.searchCandidateChannels(filters.query, publishedAfter, filters.maxResults ?? 25)
    if (candidates.length === 0) return []

    // channels.list: 1 unidad/llamada — hidrata stats + uploads playlist.
    const hydrated = await this.hydrateChannels(candidates.map((c) => c.channelId))

    const results: DiscoveredChannel[] = []
    for (const candidate of candidates) {
      const info = hydrated.get(candidate.channelId)
      const uploadsPlaylistId = info?.uploadsPlaylistId
      if (!uploadsPlaylistId) continue

      const recentVideoIds = await this.getRecentVideoIds(uploadsPlaylistId)
      if (recentVideoIds.length === 0) continue

      const videoStats = await this.getVideoStats(recentVideoIds.map((v) => v.videoId))

      const views = videoStats.map((v) => v.viewCount)
      const avgRecentViews = views.reduce((a, b) => a + b, 0) / views.length
      const shortsCount = videoStats.filter((v) => isShort(v.durationSeconds)).length
      const shortsRatio = shortsCount / videoStats.length

      const channelAgeDays = (Date.now() - new Date(candidate.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
      const oldestRecent = recentVideoIds[recentVideoIds.length - 1]
      const windowDays = Math.max(
        1,
        (Date.now() - new Date(oldestRecent.videoPublishedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      const uploadVelocityPerWeek = (recentVideoIds.length / windowDays) * 7

      const monetizationScore = calculateMonetizationScore({
        channelAgeDays,
        uploadVelocityPerWeek,
        avgRecentViews,
        subscriberCount: info.subscriberCount,
        filters: {
          maxAgeDays: filters.maxAgeDays,
          maxSubscribers: filters.maxSubscribers,
          minAvgViews: filters.minAvgViews,
        },
      })

      results.push({
        youtubeChannelId: candidate.channelId,
        channelTitle: candidate.title,
        channelPublishedAt: candidate.publishedAt,
        subscriberCount: info.subscriberCount,
        recentVideoCount: videoStats.length,
        avgRecentViews,
        shortsRatio,
        uploadVelocityPerWeek,
        monetizationScore,
      })
    }

    return results
  }

  private async searchCandidateChannels(
    query: string,
    publishedAfter: string,
    maxResults: number
  ): Promise<{ channelId: string; title: string; publishedAt: string }[]> {
    const url = new URL(`${BASE_URL}/search`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'channel')
    url.searchParams.set('q', query)
    url.searchParams.set('publishedAfter', publishedAfter)
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { id: { channelId: string }; snippet: { title: string; publishedAt: string } }) => ({
      channelId: item.id.channelId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
    }))
  }

  private async hydrateChannels(
    channelIds: string[]
  ): Promise<Map<string, { subscriberCount: number | null; uploadsPlaylistId: string | undefined }>> {
    const url = new URL(`${BASE_URL}/channels`)
    url.searchParams.set('part', 'statistics,contentDetails')
    url.searchParams.set('id', channelIds.join(','))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    const map = new Map<string, { subscriberCount: number | null; uploadsPlaylistId: string | undefined }>()
    for (const item of data.items ?? []) {
      map.set(item.id, {
        subscriberCount: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : null,
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
      })
    }
    return map
  }

  private async getRecentVideoIds(
    uploadsPlaylistId: string
  ): Promise<{ videoId: string; videoPublishedAt: string }[]> {
    const url = new URL(`${BASE_URL}/playlistItems`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', uploadsPlaylistId)
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { contentDetails: { videoId: string; videoPublishedAt: string } }) => ({
      videoId: item.contentDetails.videoId,
      videoPublishedAt: item.contentDetails.videoPublishedAt,
    }))
  }

  private async getVideoStats(
    videoIds: string[]
  ): Promise<{ viewCount: number; durationSeconds: number }[]> {
    const url = new URL(`${BASE_URL}/videos`)
    url.searchParams.set('part', 'statistics,contentDetails')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { statistics: { viewCount?: string }; contentDetails: { duration: string } }) => ({
      viewCount: Number(item.statistics.viewCount ?? 0),
      durationSeconds: parseISO8601Duration(item.contentDetails.duration),
    }))
  }
}
