import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: discovery_runs / discovery_results', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  it('un investigador puede crear un discovery_run y sus resultados', async () => {
    const user = await createTestUser('investigador', 'inv-disc')
    createdUserIds.push(user.userId)

    const { data: run, error: runError } = await user.client
      .from('discovery_runs')
      .insert({ created_by: user.userId, filters: { maxAgeDays: 90, maxSubscribers: 100000, minAvgViews: 1000 }, status: 'completed' })
      .select()
      .single()

    expect(runError).toBeNull()

    const { error: resultError } = await user.client.from('discovery_results').insert({
      discovery_run_id: run!.id,
      youtube_channel_id: 'UC_test123',
      channel_title: 'Canal de prueba',
      channel_published_at: new Date().toISOString(),
      subscriber_count: 500,
      recent_video_count: 10,
      avg_recent_views: 5000,
      shorts_ratio: 0.8,
      upload_velocity_per_week: 4,
      monetization_score: 72.5,
    })

    expect(resultError).toBeNull()
  })

  it('un guionista no puede crear un discovery_run', async () => {
    const user = await createTestUser('guionista', 'guion-disc')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('discovery_runs')
      .insert({ created_by: user.userId, filters: {}, status: 'pending' })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer discovery_runs y discovery_results', async () => {
    const investigador = await createTestUser('investigador', 'inv-disc2')
    createdUserIds.push(investigador.userId)
    await investigador.client
      .from('discovery_runs')
      .insert({ created_by: investigador.userId, filters: {}, status: 'completed' })

    const guionista = await createTestUser('guionista', 'guion-disc2')
    createdUserIds.push(guionista.userId)

    const { data, error } = await guionista.client.from('discovery_runs').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
