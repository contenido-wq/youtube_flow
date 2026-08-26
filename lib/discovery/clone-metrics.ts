import type { CatalogVideo } from './channel-catalog'
import { calculateUploadCadence, findOutlierVideos } from './clone-analysis'

export interface CloneMetrics {
  uploadCadencePerWeek: number
  avgViews: number
  topOutlier: { title: string; viewCount: number } | null
}

export function summarizeCloneMetrics(videos: CatalogVideo[]): CloneMetrics {
  if (videos.length === 0) return { uploadCadencePerWeek: 0, avgViews: 0, topOutlier: null }

  const uploadCadencePerWeek = calculateUploadCadence(videos)
  const avgViews = videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length

  const outliers = findOutlierVideos(videos)
  const topOutlier = outliers.reduce<CatalogVideo | null>(
    (max, v) => (!max || v.viewCount > max.viewCount ? v : max),
    null
  )

  return {
    uploadCadencePerWeek,
    avgViews,
    topOutlier: topOutlier ? { title: topOutlier.title, viewCount: topOutlier.viewCount } : null,
  }
}
