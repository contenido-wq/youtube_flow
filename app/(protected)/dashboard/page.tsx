import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getDashboardNewsItems } from '@/lib/news/ensure-fresh-digest'
import type { NewsCategory } from '@/lib/news/types'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </Card>
  )
}

const CATEGORY_ORDER: NewsCategory[] = ['oficial', 'competencia', 'canales_nuevos', 'recomendacion']

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  oficial: 'Oficial YouTube',
  competencia: 'Competencia',
  canales_nuevos: 'Canales nuevos',
  recomendacion: 'Recomendaciones',
}

const CATEGORY_BADGE_TONE: Record<NewsCategory, 'lime' | 'sky' | 'coral' | 'neutral'> = {
  oficial: 'sky',
  competencia: 'coral',
  canales_nuevos: 'lime',
  recomendacion: 'neutral',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const niches = Array.from(new Set((channels ?? []).map((c) => c.niche)))

  let newsItems: Awaited<ReturnType<typeof getDashboardNewsItems>> = []
  try {
    newsItems = await getDashboardNewsItems(supabase, user.id, niches)
  } catch {
    // La sección de noticias es complementaria — si falla, el resto del
    // dashboard debe seguir funcionando.
    newsItems = []
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

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Noticias</h2>

        {newsItems.length === 0 && (
          <Card>
            <p className="text-muted">Todavía no hay noticias generadas.</p>
          </Card>
        )}

        {CATEGORY_ORDER.map((category) => {
          const items = newsItems.filter((item) => item.category === category)
          if (items.length === 0) return null

          return (
            <div key={category} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="grid gap-3">
                {items.map((item) => (
                  <Card key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={CATEGORY_BADGE_TONE[category]}>{CATEGORY_LABELS[category]}</Badge>
                        <p className="mt-2 font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 text-sm text-muted">{item.summary}</p>
                      </div>
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-sm font-medium text-ink underline"
                        >
                          Ver fuente
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
