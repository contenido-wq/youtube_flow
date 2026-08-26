import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: channelsCount },
    { count: videosCount },
    { count: discoveryRunsCount },
    { count: clonePlansCount },
    { data: channels },
    { data: videos },
    { data: clonePlans },
  ] = await Promise.all([
    supabase.from('channels').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('discovery_runs').select('*', { count: 'exact', head: true }),
    supabase.from('channel_clone_plans').select('*', { count: 'exact', head: true }),
    supabase.from('channels').select('id, name, niche').order('created_at', { ascending: false }),
    supabase.from('videos').select('id, channel_id, status'),
    supabase.from('channel_clone_plans').select('id, channel_id'),
  ])

  const videosByChannel = new Map<string, { total: number; scripted: number }>()
  for (const v of videos ?? []) {
    const entry = videosByChannel.get(v.channel_id) ?? { total: 0, scripted: 0 }
    entry.total += 1
    if (v.status === 'scripted') entry.scripted += 1
    videosByChannel.set(v.channel_id, entry)
  }

  const clonePlansByChannel = new Map<string, number>()
  for (const p of clonePlans ?? []) {
    clonePlansByChannel.set(p.channel_id, (clonePlansByChannel.get(p.channel_id) ?? 0) + 1)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Canales" value={channelsCount ?? 0} />
        <StatCard label="Guiones generados" value={videosCount ?? 0} />
        <StatCard label="Búsquedas de scouting" value={discoveryRunsCount ?? 0} />
        <StatCard label="Planes de clonación" value={clonePlansCount ?? 0} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-ink">Tus canales</h2>

      {channels?.length === 0 && (
        <Card>
          <p className="text-muted">
            Todavía no hay canales.{' '}
            <Link href="/canales/nuevo" className="font-medium text-ink underline">
              Crea el primero
            </Link>
            .
          </p>
        </Card>
      )}

      <div className="grid gap-3">
        {channels?.map((c) => {
          const videoStats = videosByChannel.get(c.id) ?? { total: 0, scripted: 0 }
          const clonePlanCount = clonePlansByChannel.get(c.id) ?? 0

          return (
            <Link key={c.id} href={`/canales/${c.id}`}>
              <Card className="flex items-center justify-between gap-4 hover:shadow-md">
                <div>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">{c.niche}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="lime">{videoStats.scripted}/{videoStats.total} guiones</Badge>
                  <Badge tone="sky">{clonePlanCount} planes de clonación</Badge>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
