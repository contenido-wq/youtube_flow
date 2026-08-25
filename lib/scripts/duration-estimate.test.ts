import { describe, it, expect } from 'vitest'
import { estimateTargetCharacterCount } from './duration-estimate'

describe('estimateTargetCharacterCount', () => {
  it('convierte duración a caracteres usando la tasa dada, con margen de sobra por defecto', () => {
    // 480s = 8 min, 750 chars/min -> 6000 base, +12% = 6720
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 480, charsPerMinute: 750 })
    expect(result).toBe(6720)
  })

  it('respeta un overshootPercent custom', () => {
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 480, charsPerMinute: 750, overshootPercent: 0 })
    expect(result).toBe(6000)
  })

  it('redondea a un entero', () => {
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 63, charsPerMinute: 750 })
    expect(Number.isInteger(result)).toBe(true)
  })
})
