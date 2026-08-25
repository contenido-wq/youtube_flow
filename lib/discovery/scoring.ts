export interface ScoringFilters {
  maxAgeDays: number
  maxSubscribers: number
  minAvgViews: number
}

export interface ScoringInput {
  channelAgeDays: number
  uploadVelocityPerWeek: number
  avgRecentViews: number
  subscriberCount: number | null
  filters: ScoringFilters
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Pesos del puntaje compuesto (spec 5.1: los suscriptores solos son una señal
// débil de monetización real desde el ajuste de umbrales de YouTube de agosto
// 2026 — se pondera más la trayectoria (velocidad + desempeño de vistas) que
// el tamaño de audiencia actual).
const WEIGHT_AGE_FIT = 30
const WEIGHT_VIEWS_FIT = 30
const WEIGHT_UPLOAD_VELOCITY = 25
const WEIGHT_SUBSCRIBER_HEADROOM = 15

// Cadencia de subida considerada "de fábrica" — a partir de esto se otorga
// el puntaje completo de velocidad. Ajustable si el equipo calibra otro valor.
const FACTORY_VELOCITY_PER_WEEK = 3

export function calculateMonetizationScore(input: ScoringInput): number {
  const { channelAgeDays, uploadVelocityPerWeek, avgRecentViews, subscriberCount, filters } = input

  const ageFit = WEIGHT_AGE_FIT * clamp(1 - channelAgeDays / filters.maxAgeDays, 0, 1)

  const viewsFit =
    WEIGHT_VIEWS_FIT *
    clamp((avgRecentViews - filters.minAvgViews) / filters.minAvgViews, 0, 1)

  const velocityFit =
    WEIGHT_UPLOAD_VELOCITY * clamp(uploadVelocityPerWeek / FACTORY_VELOCITY_PER_WEEK, 0, 1)

  const subscriberHeadroom =
    WEIGHT_SUBSCRIBER_HEADROOM *
    clamp(1 - (subscriberCount ?? 0) / filters.maxSubscribers, 0, 1)

  const total = ageFit + viewsFit + velocityFit + subscriberHeadroom

  return Math.round(clamp(total, 0, 100) * 10) / 10
}
