import { describe, it, expect, vi, afterEach } from 'vitest'
import { ensureFreshDigest } from './ensure-fresh-digest'
import { createTestUser, deleteTestUser } from '../../tests/helpers/supabase-test-client'

describe('ensureFreshDigest', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  const emptyNicheSignals = { competencia: [], canalesNuevos: [] }

  it('genera un digest nuevo cuando no existe ninguno', async () => {
    const user = await createTestUser('investigador', 'news-fresh')
    createdUserIds.push(user.userId)

    const generateDigestItems = vi.fn().mockResolvedValue([
      { category: 'oficial', title: 'Título 1', summary: 'Resumen 1', source_url: null, source_channel_youtube_id: null },
    ])

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: ['finanzas personales'],
      fetchOfficialUpdates: vi.fn().mockResolvedValue([]),
      fetchNicheSignals: vi.fn().mockResolvedValue(emptyNicheSignals),
      generateDigestItems,
      scopeToCreatedBy: user.userId,
    })

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Título 1')
    expect(generateDigestItems).toHaveBeenCalledTimes(1)

    const { data: runs } = await user.client.from('news_digest_runs').select('*').eq('created_by', user.userId)
    expect(runs).toHaveLength(1)
    expect(runs![0].status).toBe('completed')
  })

  it('no regenera si el último digest completado tiene menos de 24h', async () => {
    const user = await createTestUser('investigador', 'news-recent')
    createdUserIds.push(user.userId)

    const { data: run } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'completed', completed_at: new Date().toISOString() })
      .select()
      .single()
    await user.client.from('news_items').insert({
      digest_run_id: run!.id,
      category: 'recomendacion',
      title: 'Ya existente',
      summary: 'Resumen existente.',
    })

    const generateDigestItems = vi.fn()

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: [],
      fetchOfficialUpdates: vi.fn(),
      fetchNicheSignals: vi.fn(),
      generateDigestItems,
      scopeToCreatedBy: user.userId,
    })

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Ya existente')
    expect(generateDigestItems).not.toHaveBeenCalled()
  })

  it('regenera si el último digest completado tiene más de 24h', async () => {
    const user = await createTestUser('investigador', 'news-stale')
    createdUserIds.push(user.userId)

    const staleCompletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { data: staleRun } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'completed', completed_at: staleCompletedAt })
      .select()
      .single()
    await user.client.from('news_items').insert({
      digest_run_id: staleRun!.id,
      category: 'recomendacion',
      title: 'Viejo',
      summary: 'Resumen viejo.',
    })

    const generateDigestItems = vi.fn().mockResolvedValue([
      { category: 'recomendacion', title: 'Nuevo', summary: 'Resumen nuevo.', source_url: null, source_channel_youtube_id: null },
    ])

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: [],
      fetchOfficialUpdates: vi.fn().mockResolvedValue([]),
      fetchNicheSignals: vi.fn().mockResolvedValue(emptyNicheSignals),
      generateDigestItems,
      scopeToCreatedBy: user.userId,
    })

    expect(generateDigestItems).toHaveBeenCalledTimes(1)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Nuevo')
  })

  it('si la generación falla, marca el run como failed y cae al último digest completado', async () => {
    const user = await createTestUser('investigador', 'news-fail')
    createdUserIds.push(user.userId)

    const staleCompletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { data: staleRun } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'completed', completed_at: staleCompletedAt })
      .select()
      .single()
    await user.client.from('news_items').insert({
      digest_run_id: staleRun!.id,
      category: 'recomendacion',
      title: 'Último bueno',
      summary: 'Resumen.',
    })

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: [],
      fetchOfficialUpdates: vi.fn().mockRejectedValue(new Error('YouTube caído')),
      fetchNicheSignals: vi.fn().mockResolvedValue(emptyNicheSignals),
      generateDigestItems: vi.fn(),
      scopeToCreatedBy: user.userId,
    })

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Último bueno')

    const { data: runs } = await user.client
      .from('news_digest_runs')
      .select('*')
      .eq('created_by', user.userId)
      .eq('status', 'failed')
    expect(runs).toHaveLength(1)
    expect(runs![0].error_message).toContain('YouTube caído')
  })

  it('si generateDigestItems lanza síncronamente (ej. falla la construcción del cliente), marca el run como failed y cae al último digest completado', async () => {
    const user = await createTestUser('investigador', 'news-throw')
    createdUserIds.push(user.userId)

    const staleCompletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { data: staleRun } = await user.client
      .from('news_digest_runs')
      .insert({ created_by: user.userId, status: 'completed', completed_at: staleCompletedAt })
      .select()
      .single()
    await user.client.from('news_items').insert({
      digest_run_id: staleRun!.id,
      category: 'recomendacion',
      title: 'Último bueno (throw)',
      summary: 'Resumen.',
    })

    const generateDigestItems = vi.fn(() => {
      throw new Error('ANTHROPIC_API_KEY inválida')
    })

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: [],
      fetchOfficialUpdates: vi.fn().mockResolvedValue([]),
      fetchNicheSignals: vi.fn().mockResolvedValue(emptyNicheSignals),
      generateDigestItems,
      scopeToCreatedBy: user.userId,
    })

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Último bueno (throw)')

    const { data: runs } = await user.client
      .from('news_digest_runs')
      .select('*')
      .eq('created_by', user.userId)
      .eq('status', 'failed')
    expect(runs).toHaveLength(1)
    expect(runs![0].error_message).toContain('ANTHROPIC_API_KEY inválida')
  })

  it('si hay un run running reciente, no dispara otro y usa el último completado', async () => {
    const user = await createTestUser('investigador', 'news-lock')
    createdUserIds.push(user.userId)

    const { data: completedRun } = await user.client
      .from('news_digest_runs')
      .insert({
        created_by: user.userId,
        status: 'completed',
        completed_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()
    await user.client.from('news_items').insert({
      digest_run_id: completedRun!.id,
      category: 'recomendacion',
      title: 'Completado previo',
      summary: 'Resumen.',
    })

    await user.client.from('news_digest_runs').insert({ created_by: user.userId, status: 'running' })

    const generateDigestItems = vi.fn()

    const items = await ensureFreshDigest({
      supabase: user.client,
      userId: user.userId,
      niches: [],
      fetchOfficialUpdates: vi.fn(),
      fetchNicheSignals: vi.fn(),
      generateDigestItems,
      scopeToCreatedBy: user.userId,
    })

    expect(generateDigestItems).not.toHaveBeenCalled()
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Completado previo')
  })
})
