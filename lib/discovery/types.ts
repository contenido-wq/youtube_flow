export interface ChannelSearchFilters {
  query: string
  maxAgeDays: number
  maxSubscribers: number
  minAvgViews: number
  maxResults?: number
}

export interface DiscoveredChannel {
  youtubeChannelId: string
  channelTitle: string
  channelPublishedAt: string
  subscriberCount: number | null
  recentVideoCount: number
  avgRecentViews: number
  shortsRatio: number
  uploadVelocityPerWeek: number
  monetizationScore: number
}

export interface DiscoveryEngine {
  searchChannels(filters: ChannelSearchFilters): Promise<DiscoveredChannel[]>
}
