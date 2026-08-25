import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default async function CanalesPage() {
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, niche, target_language')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Canales</h1>
        <Link href="/canales/nuevo">
          <Button>+ Nuevo canal</Button>
        </Link>
      </div>

      {channels?.length === 0 && (
        <Card>
          <p className="text-muted">Todavía no hay canales. Crea el primero.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {channels?.map((c) => (
          <Link key={c.id} href={`/canales/${c.id}`}>
            <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
              <div>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-sm text-muted">{c.niche}</p>
              </div>
              <Badge tone="sky">{c.target_language}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
