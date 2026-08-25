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
}

export async function deleteTestUser(userId: string) {
  const admin = serviceClient()
  await admin.auth.admin.deleteUser(userId)
}
