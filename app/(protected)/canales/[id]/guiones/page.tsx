import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default async function GuionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await params
  const supabase = await createClient()
  const { data: videos } = await supabase
    .from('videos')
    .select('id, topic, status, target_duration_seconds')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Guiones</h1>
        <Link href={`/canales/${channelId}/guiones/nuevo`}>
          <Button>+ Nuevo guion</Button>
        </Link>
      </div>
      <div className="grid gap-3">
        {videos?.map((v) => (
          <Link key={v.id} href={`/canales/${channelId}/guiones/${v.id}`}>
            <Card className="flex items-center justify-between hover:shadow-md">
              <div>
                <p className="font-semibold text-ink">{v.topic}</p>
                <p className="text-sm text-muted">{Math.round(v.target_duration_seconds / 60)} min objetivo</p>
              </div>
              <Badge tone={v.status === 'scripted' ? 'lime' : v.status === 'failed' ? 'coral' : 'sky'}>{v.status}</Badge>
            </Card>
          </Link>
        ))}
        {videos?.length === 0 && (
          <Card><p className="text-muted">Todavía no hay guiones para este canal.</p></Card>
        )}
      </div>
    </div>
  )
}
