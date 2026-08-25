import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: team_members', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  it('cualquier usuario autenticado puede leer todos los team_members', async () => {
    const admin = await createTestUser('admin', 'admin')
    createdUserIds.push(admin.userId)
    const viewer = await createTestUser('guionista', 'viewer')
    createdUserIds.push(viewer.userId)

    const { data, error } = await viewer.client.from('team_members').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(2)
  })

  it('un rol no-admin no puede cambiar el rol de otro miembro', async () => {
    const admin = await createTestUser('admin', 'admin2')
    createdUserIds.push(admin.userId)
    const nonAdmin = await createTestUser('guionista', 'nonadmin')
    createdUserIds.push(nonAdmin.userId)

    const { error } = await nonAdmin.client
      .from('team_members')
      .update({ role: 'admin' })
      .eq('id', admin.userId)

    expect(error).not.toBeNull()
  })

  it('un admin sí puede cambiar el rol de otro miembro', async () => {
    const admin = await createTestUser('admin', 'admin3')
    createdUserIds.push(admin.userId)
    const target = await createTestUser('guionista', 'target')
    createdUserIds.push(target.userId)

    const { error } = await admin.client
      .from('team_members')
      .update({ role: 'editor' })
      .eq('id', target.userId)

    expect(error).toBeNull()
  })
})
