import { describe, it, expect, vi } from 'vitest'
import { fetchNicheSignals } from './fetch-niche-signals'
import type { DiscoveredChannel, DiscoveryEngine } from '@/lib/discovery/types'

function channel(overrides: Partial<DiscoveredChannel>): DiscoveredChannel {
  return {
    youtubeChannelId: 'UC_default',
    channelTitle: 'Canal',
    channelPublishedAt: new Date().toISOString(),
    subscriberCount: 0,
    recentVideoCount: 10,
    avgRecentViews: 1000,
    shortsRatio: 0.5,
    uploadVelocityPerWeek: 3,
    monetizationScore: 0.5,
    ...overrides,
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

describe('fetchNicheSignals', () => {
  it('clasifica canales jóvenes como nuevos y canales viejos con suficientes suscriptores como competencia', async () => {
    const searchChannels = vi.fn().mockResolvedValue([
      channel({ youtubeChannelId: 'UC_new', channelPublishedAt: daysAgo(30), subscriberCount: 500 }),
      channel({ youtubeChannelId: 'UC_established', channelPublishedAt: daysAgo(1000), subscriberCount: 50000 }),
      channel({ youtubeChannelId: 'UC_old_small', channelPublishedAt: daysAgo(1000), subscriberCount: 200 }),
    ])
    const engine: DiscoveryEngine = { searchChannels }

    const result = await fetchNicheSignals(engine, ['finanzas personales'])

    expect(result.canalesNuevos.map((c) => c.youtubeChannelId)).toEqual(['UC_new'])
    expect(result.competencia.map((c) => c.youtubeChannelId)).toEqual(['UC_established'])
    expect(searchChannels).toHaveBeenCalledTimes(1)
  })

  it('deduplica nichos y busca como máximo 3', async () => {
    const searchChannels = vi.fn().mockResolvedValue([])
    const engine: DiscoveryEngine = { searchChannels }

    await fetchNicheSignals(engine, ['a', 'b', 'a', 'c', 'd'])

    expect(searchChannels).toHaveBeenCalledTimes(3)
    expect(searchChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ query: 'a' }))
    expect(searchChannels).toHaveBeenNthCalledWith(2, expect.objectContaining({ query: 'b' }))
    expect(searchChannels).toHaveBeenNthCalledWith(3, expect.objectContaining({ query: 'c' }))
  })
})
