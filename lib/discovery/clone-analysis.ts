export function calculateUploadCadence(videos: { publishedAt: string }[]): number {
  if (videos.length < 2) return 0

  const timestamps = videos.map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => a - b)
  const windowDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
  if (windowDays === 0) return 0

  return (videos.length / windowDays) * 7
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const DEFAULT_OUTLIER_MULTIPLIER = 2

export function findOutlierVideos<T extends { viewCount: number }>(
  videos: T[],
  multiplier: number = DEFAULT_OUTLIER_MULTIPLIER
): T[] {
  if (videos.length === 0) return []

  const medianViews = median(videos.map((v) => v.viewCount))
  return videos.filter((v) => v.viewCount > medianViews * multiplier)
}
