import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: news', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  it('cualquier rol autenticado puede crear un digest run (a diferencia de discovery_runs)', async () => {
    const user = await createTestUser('guionista', 'guionista-news')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'running' })

    expect(error).toBeNull()
  })

  it('cualquier rol autenticado puede insertar items en un digest run', async () => {
    const user = await createTestUser('editor', 'editor-news')
    createdUserIds.push(user.userId)

    const { data: run, error: runError } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'running' })
      .select()
      .single()
    expect(runError).toBeNull()

    const { error: itemError } = await user.client.from('news_items').insert({
      digest_run_id: run!.id,
      category: 'oficial',
      title: 'YouTube lanza nueva función',
      summary: 'Resumen de prueba.',
    })

    expect(itemError).toBeNull()
  })

  it('cualquier autenticado puede leer los digest runs y sus items', async () => {
    const creator = await createTestUser('investigador', 'investigador-news')
    createdUserIds.push(creator.userId)

    const { data: run } = await creator.client
      .from('news_digest_runs')
      .insert({ created_by: creator.userId, status: 'completed' })
      .select()
      .single()
    await creator.client.from('news_items').insert({
      digest_run_id: run!.id,
      category: 'recomendacion',
      title: 'Prueba',
      summary: 'Resumen de prueba.',
    })

    const reader = await createTestUser('aprobador', 'aprobador-news')
    createdUserIds.push(reader.userId)

    const { data: runs, error: runsError } = await reader.client.from('news_digest_runs').select('*')
    const { data: items, error: itemsError } = await reader.client.from('news_items').select('*')

    expect(runsError).toBeNull()
    expect(itemsError).toBeNull()
    expect(runs!.length).toBeGreaterThanOrEqual(1)
    expect(items!.length).toBeGreaterThanOrEqual(1)
  })
})
