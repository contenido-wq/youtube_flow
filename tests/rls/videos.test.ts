import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: videos', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  async function makeChannel(client: Awaited<ReturnType<typeof createTestUser>>['client'], userId: string) {
    const { data } = await client
      .from('channels')
      .insert({
        name: 'Canal de prueba guiones',
        niche: 'finanzas personales',
        target_language: 'es',
        variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
        created_by: userId,
      })
      .select()
      .single()
    return data!.id
  }

  it('un investigador puede crear un video (guion)', async () => {
    const user = await createTestUser('investigador', 'inv-video')
    createdUserIds.push(user.userId)
    const channelId = await makeChannel(user.client, user.userId)

    const { error } = await user.client.from('videos').insert({
      channel_id: channelId,
      topic: 'Cómo ahorrar tu primer millón',
      target_duration_seconds: 480,
      target_character_count: 6600,
      style: 'estandar',
      created_by: user.userId,
    })

    expect(error).toBeNull()
  })

  it('un guionista no puede crear un video', async () => {
    const user = await createTestUser('guionista', 'guion-video')
    createdUserIds.push(user.userId)

    const { error } = await user.client.from('videos').insert({
      channel_id: '00000000-0000-0000-0000-000000000000',
      topic: 'x',
      target_duration_seconds: 60,
      target_character_count: 750,
      created_by: user.userId,
    })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer voice_pace_calibration', async () => {
    const user = await createTestUser('guionista', 'guion-calib')
    createdUserIds.push(user.userId)

    const { data, error } = await user.client.from('voice_pace_calibration').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
