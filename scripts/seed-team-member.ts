import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const [, , email, password, role] = process.argv

if (!email || !password || !role) {
  console.error('Uso: npx tsx scripts/seed-team-member.ts <email> <password> <rol>')
  console.error('Roles válidos: admin, investigador, guionista, editor, aprobador')
  process.exit(1)
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Error creando usuario: ${error?.message}`)

  const { error: insertError } = await admin
    .from('team_members')
    .insert({ id: data.user.id, email, role })
  if (insertError) throw new Error(`Error insertando team_member: ${insertError.message}`)

  console.log(`Usuario creado: ${email} (rol: ${role})`)
}

main()
