import { describe, it, expect } from 'vitest'
import { simplifyNicheQueries } from './simplify-niche-query'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('simplifyNicheQueries', () => {
  it('devuelve un array vacío sin llamar a Claude si no hay nichos', async () => {
    const client = fakeAnthropicClient('no debería usarse')
    const result = await simplifyNicheQueries(client, [])
    expect(result).toEqual([])
  })

  it('parsea el array JSON de consultas cortas que devuelve Claude', async () => {
    const client = fakeAnthropicClient(JSON.stringify(['análisis de actualidad', 'finanzas personales']))

    const result = await simplifyNicheQueries(client, [
      'Ensayos de opinión y análisis de actualidad narrados con animación de monigotes en pizarra digital',
      'Finanzas personales para principiantes en Latinoamérica',
    ])

    expect(result).toEqual(['análisis de actualidad', 'finanzas personales'])
  })

  it('cae de vuelta a los nichos originales si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('esto no es JSON')
    const result = await simplifyNicheQueries(client, ['nicho largo de prueba'])
    expect(result).toEqual(['nicho largo de prueba'])
  })

  it('cae de vuelta a los nichos originales si la forma no coincide (largo distinto)', async () => {
    const client = fakeAnthropicClient(JSON.stringify(['solo una']))
    const result = await simplifyNicheQueries(client, ['nicho uno', 'nicho dos'])
    expect(result).toEqual(['nicho uno', 'nicho dos'])
  })
})
