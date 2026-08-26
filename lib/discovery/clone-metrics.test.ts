import { describe, it, expect } from 'vitest'
import { summarizeCloneMetrics } from './clone-metrics'

function video(overrides: Partial<{ videoId: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number }>) {
  return {
    videoId: 'v1',
    title: 'Video',
    publishedAt: '2026-01-01T00:00:00Z',
    viewCount: 1000,
    durationSeconds: 300,
    ...overrides,
  }
}

describe('summarizeCloneMetrics', () => {
  it('calcula cadencia, promedio de vistas y el video más outlier', () => {
    const videos = [
      video({ videoId: 'a', title: 'Normal A', publishedAt: '2026-01-01T00:00:00Z', viewCount: 1000 }),
      video({ videoId: 'b', title: 'Normal B', publishedAt: '2026-01-08T00:00:00Z', viewCount: 1200 }),
      video({ videoId: 'c', title: 'Viral C', publishedAt: '2026-01-15T00:00:00Z', viewCount: 50000 }),
    ]

    const result = summarizeCloneMetrics(videos)

    expect(result.avgViews).toBeCloseTo((1000 + 1200 + 50000) / 3)
    expect(result.uploadCadencePerWeek).toBeGreaterThan(0)
    expect(result.topOutlier).toEqual({ title: 'Viral C', viewCount: 50000 })
  })

  it('devuelve topOutlier null si ningún video se dispara sobre la mediana', () => {
    const videos = [
      video({ videoId: 'a', viewCount: 1000 }),
      video({ videoId: 'b', viewCount: 1100 }),
      video({ videoId: 'c', viewCount: 900 }),
    ]

    const result = summarizeCloneMetrics(videos)

    expect(result.topOutlier).toBeNull()
  })

  it('devuelve ceros/null en un catálogo vacío, sin lanzar', () => {
    const result = summarizeCloneMetrics([])

    expect(result).toEqual({ uploadCadencePerWeek: 0, avgViews: 0, topOutlier: null })
  })
})
