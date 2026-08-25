import { describe, it, expect } from 'vitest'
import { channelSchema } from '@/lib/channels/schema'

describe('channelSchema', () => {
  const validInput = {
    name: 'Finanzas Fáciles',
    niche: 'finanzas personales',
    target_language: 'es',
    variation_rules: 'Variar el ángulo del hook y los ejemplos citados en cada video.',
  }

  it('acepta un input válido', () => {
    const result = channelSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rechaza un nombre vacío', () => {
    const result = channelSchema.safeParse({ ...validInput, name: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza reglas de variación demasiado cortas para ser accionables', () => {
    const result = channelSchema.safeParse({ ...validInput, variation_rules: 'variar' })
    expect(result.success).toBe(false)
  })

  it('rechaza un idioma que no sea un código de 2 letras', () => {
    const result = channelSchema.safeParse({ ...validInput, target_language: 'español' })
    expect(result.success).toBe(false)
  })
})
