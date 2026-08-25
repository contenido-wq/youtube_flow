import { describe, it, expect } from 'vitest'
import { calculateMonetizationScore } from './scoring'

const baseFilters = { maxAgeDays: 90, maxSubscribers: 100000, minAvgViews: 1000 }

describe('calculateMonetizationScore', () => {
  it('un canal nuevo, con alta velocidad y muchas vistas, pero pocos subs, saca puntaje alto', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 20,
      uploadVelocityPerWeek: 5,
      avgRecentViews: 5000,
      subscriberCount: 2000,
      filters: baseFilters,
    })
    expect(score).toBeGreaterThan(70)
  })

  it('un canal casi al límite de edad y de subs, con pocas vistas, saca puntaje bajo', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 88,
      uploadVelocityPerWeek: 0.5,
      avgRecentViews: 1050,
      subscriberCount: 95000,
      filters: baseFilters,
    })
    expect(score).toBeLessThan(30)
  })

  it('el puntaje siempre está entre 0 y 100', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 0,
      uploadVelocityPerWeek: 50,
      avgRecentViews: 1_000_000,
      subscriberCount: 0,
      filters: baseFilters,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('subscriberCount null (canal con contador oculto) no rompe el cálculo', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 30,
      uploadVelocityPerWeek: 3,
      avgRecentViews: 3000,
      subscriberCount: null,
      filters: baseFilters,
    })
    expect(Number.isFinite(score)).toBe(true)
  })
})
