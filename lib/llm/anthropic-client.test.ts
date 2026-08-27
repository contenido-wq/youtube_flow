import { describe, it, expect } from 'vitest'
import { extractText } from './anthropic-client'

describe('extractText', () => {
  it('devuelve el texto del primer bloque de tipo text', () => {
    const result = extractText([{ type: 'text', text: '{"a": 1}' }])
    expect(result).toBe('{"a": 1}')
  })

  it('despoja un bloque de código markdown con lenguaje json', () => {
    const result = extractText([{ type: 'text', text: '```json\n{"a": 1}\n```' }])
    expect(result).toBe('{"a": 1}')
  })

  it('despoja un bloque de código markdown sin lenguaje especificado', () => {
    const result = extractText([{ type: 'text', text: '```\n{"a": 1}\n```' }])
    expect(result).toBe('{"a": 1}')
  })

  it('devuelve string vacío si no hay bloque de texto', () => {
    const result = extractText([{ type: 'thinking' }])
    expect(result).toBe('')
  })
})
