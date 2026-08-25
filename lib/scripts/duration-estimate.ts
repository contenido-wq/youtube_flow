export interface DurationEstimateInput {
  targetDurationSeconds: number
  charsPerMinute: number
  overshootPercent?: number
}

const DEFAULT_OVERSHOOT_PERCENT = 12

export function estimateTargetCharacterCount(input: DurationEstimateInput): number {
  const overshoot = input.overshootPercent ?? DEFAULT_OVERSHOOT_PERCENT
  const baseCharacters = (input.targetDurationSeconds / 60) * input.charsPerMinute
  return Math.round(baseCharacters * (1 + overshoot / 100))
}
