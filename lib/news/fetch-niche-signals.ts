import type { ChannelSearchFilters, DiscoveredChannel, DiscoveryEngine } from '@/lib/discovery/types'

const MAX_NICHES_PER_RUN = 3
const NEW_CHANNEL_MAX_AGE_DAYS = 180
const ESTABLISHED_MIN_SUBSCRIBERS = 10000

const NICHE_SEARCH_FILTERS: Omit<ChannelSearchFilters, 'query'> = {
  maxAgeDays: 3650,
  maxSubscribers: 1_000_000,
  minAvgViews: 1000,
  maxResults: 15,
}

export interface NicheSignals {
  competencia: DiscoveredChannel[]
  canalesNuevos: DiscoveredChannel[]
}

export async function fetchNicheSignals(engine: DiscoveryEngine, allNiches: string[]): Promise<NicheSignals> {
  const distinctNiches = Array.from(new Set(allNiches)).slice(0, MAX_NICHES_PER_RUN)

  const competencia: DiscoveredChannel[] = []
  const canalesNuevos: DiscoveredChannel[] = []

  const results = await Promise.all(
    distinctNiches.map((niche) => engine.searchChannels({ query: niche, ...NICHE_SEARCH_FILTERS }))
  )

  for (const channelResults of results) {
    for (const channel of channelResults) {
      const ageDays = (Date.now() - new Date(channel.channelPublishedAt).getTime()) / (1000 * 60 * 60 * 24)

      if (ageDays < NEW_CHANNEL_MAX_AGE_DAYS) {
        canalesNuevos.push(channel)
      } else if (channel.subscriberCount !== null && channel.subscriberCount >= ESTABLISHED_MIN_SUBSCRIBERS) {
        competencia.push(channel)
      }
    }
  }

  return { competencia, canalesNuevos }
}
