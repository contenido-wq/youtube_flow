import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CanalesPage() {
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, niche, target_language')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1>Canales</h1>
      <Link href="/canales/nuevo">+ Nuevo canal</Link>
      <ul>
        {channels?.map((c) => (
          <li key={c.id}>
            <Link href={`/canales/${c.id}`}>{c.name}</Link> — {c.niche} ({c.target_language})
          </li>
        ))}
      </ul>
      {channels?.length === 0 && <p>Todavía no hay canales. Crea el primero.</p>}
    </div>
  )
}
