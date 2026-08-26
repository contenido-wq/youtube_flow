import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createTestUser(role: string, emailPrefix: string) {
  const admin = serviceClient()
  const email = `${emailPrefix}-${Date.now()}@test.local`
  const password = 'test-password-123!'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`No se pudo crear usuario de prueba: ${error?.message}`)

  // Si algo después de este punto falla, el usuario de auth ya existe pero
  // nunca se devuelve su userId al llamador — sin este catch, ese usuario
  // queda huérfano para siempre (nadie más tiene su id para poder borrarlo).
  try {
    const { error: insertError } = await admin
      .from('team_members')
      .insert({ id: data.user.id, email, role })
    if (insertError) throw new Error(`No se pudo insertar team_member: ${insertError.message}`)

    const scopedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: signInError } = await scopedClient.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error(`No se pudo iniciar sesión de prueba: ${signInError.message}`)

    return { client: scopedClient, userId: data.user.id, email }
  } catch (err) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw err
  }
}

export async function deleteTestUser(userId: string) {
  const admin = serviceClient()

  // channels.created_by / discovery_runs.created_by / channel_clone_plans.created_by /
  // videos.created_by all reference team_members(id) WITHOUT cascade (deleting a
  // real team member should never silently delete the content they created) —
  // so test cleanup must delete any rows a test user created before deleting
  // the user itself, or the FK blocks the delete. clone_plan_items and
  // discovery_results cascade from their parents, so deleting these four is enough.
  await admin.from('videos').delete().eq('created_by', userId)
  await admin.from('channels').delete().eq('created_by', userId)
  await admin.from('discovery_runs').delete().eq('created_by', userId)
  await admin.from('channel_clone_plans').delete().eq('created_by', userId)
  await admin.from('news_digest_runs').delete().eq('created_by', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`No se pudo borrar el usuario de prueba ${userId}: ${error.message}`)
}
