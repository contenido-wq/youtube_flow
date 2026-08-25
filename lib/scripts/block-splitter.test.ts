import { describe, it, expect } from 'vitest'
import { splitIntoCoherentBlocks } from './block-splitter'

describe('splitIntoCoherentBlocks', () => {
  const text =
    'Esta es la primera oración del guion. Esta es la segunda oración, un poco más larga que la anterior. ' +
    'Aquí viene la tercera oración. Y finalmente la cuarta oración cierra el bloque de ejemplo.'

  it('nunca corta una oración a la mitad', () => {
    const blocks = splitIntoCoherentBlocks(text, 60)
    for (const block of blocks) {
      expect(block.trim().endsWith('.')).toBe(true)
    }
  })

  it('reconstruye el texto completo al unir los bloques', () => {
    const blocks = splitIntoCoherentBlocks(text, 60)
    expect(blocks.join(' ')).toBe(text)
  })

  it('con un tamaño objetivo mayor al texto completo, devuelve un solo bloque', () => {
    const blocks = splitIntoCoherentBlocks(text, 10000)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toBe(text)
  })

  it('devuelve un array vacío para texto vacío', () => {
    expect(splitIntoCoherentBlocks('', 100)).toEqual([])
  })
})
