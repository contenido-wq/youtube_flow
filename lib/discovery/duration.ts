const ISO_8601_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/

export function parseISO8601Duration(duration: string): number {
  const match = ISO_8601_DURATION_REGEX.exec(duration)
  if (!match) return 0

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)

  return hours * 3600 + minutes * 60 + seconds
}

// YouTube Shorts: videos de hasta 3 minutos (180s) a la fecha de este spec.
const SHORTS_MAX_SECONDS = 180

export function isShort(durationSeconds: number): boolean {
  return durationSeconds <= SHORTS_MAX_SECONDS
}
