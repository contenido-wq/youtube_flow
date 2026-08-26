import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default async function TodosLosGuionesPage() {
  const supabase = await createClient()
  const { data: videos } = await supabase
    .from('videos')
    .select('id, topic, status, target_duration_seconds, channel_id, channels(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Guiones</h1>

      {videos?.length === 0 && (
        <Card>
          <p className="text-muted">
            Todavía no hay guiones. Entra a un canal y crea uno desde su página.
          </p>
        </Card>
      )}

      <div className="grid gap-3">
        {videos?.map((v) => (
          <Link key={v.id} href={`/canales/${v.channel_id}/guiones/${v.id}`}>
            <Card className="flex items-center justify-between hover:shadow-md">
              <div>
                <p className="font-semibold text-ink">{v.topic}</p>
                <p className="text-sm text-muted">
                  {(v.channels as unknown as { name: string } | null)?.name ?? 'Canal'} — {Math.round(v.target_duration_seconds / 60)} min objetivo
                </p>
              </div>
              <Badge tone={v.status === 'scripted' ? 'lime' : v.status === 'failed' ? 'coral' : 'sky'}>{v.status}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
