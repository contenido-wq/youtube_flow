import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: channels', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  const baseChannel = {
    name: 'Canal de prueba',
    niche: 'finanzas personales',
    target_language: 'es',
    variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
  }

  it('un investigador puede crear un canal', async () => {
    const user = await createTestUser('investigador', 'investigador')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('channels')
      .insert({ ...baseChannel, created_by: user.userId })

    expect(error).toBeNull()
  })

  it('un guionista no puede crear un canal', async () => {
    const user = await createTestUser('guionista', 'guionista')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('channels')
      .insert({ ...baseChannel, created_by: user.userId })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer los canales', async () => {
    const investigador = await createTestUser('investigador', 'investigador2')
    createdUserIds.push(investigador.userId)
    await investigador.client.from('channels').insert({ ...baseChannel, created_by: investigador.userId })

    const guionista = await createTestUser('guionista', 'guionista2')
    createdUserIds.push(guionista.userId)

    const { data, error } = await guionista.client.from('channels').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
