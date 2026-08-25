import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: channel_clone_plans / clone_plan_items', () => {
  const createdUserIds: string[] = []
  const createdChannelIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  async function makeChannel(client: Awaited<ReturnType<typeof createTestUser>>['client'], userId: string) {
    const { data } = await client
      .from('channels')
      .insert({
        name: 'Canal de prueba clon',
        niche: 'finanzas personales',
        target_language: 'es',
        variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
        created_by: userId,
      })
      .select()
      .single()
    createdChannelIds.push(data!.id)
    return data!.id
  }

  it('un investigador puede crear un clone_plan y sus items', async () => {
    const user = await createTestUser('investigador', 'inv-clone')
    createdUserIds.push(user.userId)
    const channelId = await makeChannel(user.client, user.userId)

    const { data: plan, error: planError } = await user.client
      .from('channel_clone_plans')
      .insert({
        channel_id: channelId,
        source_youtube_channel_id: 'UC_source123',
        source_channel_title: 'Canal Fuente',
        analyzed_video_count: 20,
        upload_cadence_per_week: 3,
        avg_duration_seconds: 480,
        status: 'completed',
        created_by: user.userId,
      })
      .select()
      .single()

    expect(planError).toBeNull()

    const { error: itemError } = await user.client.from('clone_plan_items').insert({
      clone_plan_id: plan!.id,
      source_video_title: 'Cómo ahorrar tu primer millón',
      source_video_views: 500000,
      proposed_topic: 'Cómo ahorrar tu primer millón (adaptado)',
      proposed_angle: 'Ángulo distinto: enfoque en errores comunes en vez de pasos',
    })

    expect(itemError).toBeNull()
  })

  it('un guionista no puede crear un clone_plan', async () => {
    const user = await createTestUser('guionista', 'guion-clone')
    createdUserIds.push(user.userId)

    const { error } = await user.client.from('channel_clone_plans').insert({
      channel_id: '00000000-0000-0000-0000-000000000000',
      source_youtube_channel_id: 'UC_x',
      source_channel_title: 'X',
      analyzed_video_count: 0,
      upload_cadence_per_week: 0,
      avg_duration_seconds: 0,
      created_by: user.userId,
    })

    expect(error).not.toBeNull()
  })
})
