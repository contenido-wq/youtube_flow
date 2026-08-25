import { describe, it, expect } from 'vitest'
import { parseISO8601Duration, isShort } from './duration'

describe('parseISO8601Duration', () => {
  it('parsea segundos solos', () => {
    expect(parseISO8601Duration('PT45S')).toBe(45)
  })

  it('parsea minutos y segundos', () => {
    expect(parseISO8601Duration('PT4M13S')).toBe(253)
  })

  it('parsea horas, minutos y segundos', () => {
    expect(parseISO8601Duration('PT1H2M3S')).toBe(3723)
  })

  it('devuelve 0 para un formato vacío o inválido', () => {
    expect(parseISO8601Duration('')).toBe(0)
    expect(parseISO8601Duration('invalid')).toBe(0)
  })
})

describe('isShort', () => {
  it('un video de 45 segundos es Short', () => {
    expect(isShort(45)).toBe(true)
  })

  it('un video de 180 segundos (3 min) es Short', () => {
    expect(isShort(180)).toBe(true)
  })

  it('un video de 181 segundos no es Short', () => {
    expect(isShort(181)).toBe(false)
  })
})
