import { describe, it, expect } from 'vitest'
import { calculateUploadCadence, findOutlierVideos } from './clone-analysis'

describe('calculateUploadCadence', () => {
  it('calcula videos por semana a partir de fechas de publicación', () => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const videos = [
      { publishedAt: new Date(now).toISOString() },
      { publishedAt: new Date(now - 7 * day).toISOString() },
      { publishedAt: new Date(now - 14 * day).toISOString() },
      { publishedAt: new Date(now - 21 * day).toISOString() },
    ]
    // 4 videos en 21 días de ventana ≈ 1.33 videos/semana
    expect(calculateUploadCadence(videos)).toBeCloseTo(1.33, 1)
  })

  it('devuelve 0 con un solo video (no hay ventana de tiempo)', () => {
    expect(calculateUploadCadence([{ publishedAt: new Date().toISOString() }])).toBe(0)
  })
})

describe('findOutlierVideos', () => {
  it('identifica videos que superan la mediana por el multiplicador', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1200 },
      { title: 'c', viewCount: 1100 },
      { title: 'd', viewCount: 50000 }, // outlier claro
    ]
    const outliers = findOutlierVideos(videos)
    expect(outliers).toHaveLength(1)
    expect(outliers[0].title).toBe('d')
  })

  it('no distorsiona con un solo outlier extremo (usa mediana, no promedio)', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1100 },
      { title: 'c', viewCount: 1000000 }, // no debería inflar el umbral para los demás
    ]
    const outliers = findOutlierVideos(videos)
    expect(outliers.map((v) => v.title)).toEqual(['c'])
  })

  it('respeta un multiplicador custom', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1000 },
      { title: 'c', viewCount: 1500 },
    ]
    expect(findOutlierVideos(videos, 1.2)).toHaveLength(1)
    expect(findOutlierVideos(videos, 3)).toHaveLength(0)
  })
})
