import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { Badge } from '@/components/ui/Badge'

export default async function ResultadosPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const supabase = await createClient()

  const { data: run } = await supabase.from('discovery_runs').select('*').eq('id', runId).single()
  if (!run) notFound()

  const { data: results } = await supabase
    .from('discovery_results')
    .select('*')
    .eq('discovery_run_id', runId)
    .order('monetization_score', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">Resultados</h1>
        <Badge tone={run.status === 'completed' ? 'lime' : run.status === 'failed' ? 'coral' : 'sky'}>{run.status}</Badge>
      </div>
      {run.error_message && (
        <Card className="mb-4 border border-accent-coral">
          <p className="text-sm font-medium text-accent-coral-ink" role="alert">{run.error_message}</p>
        </Card>
      )}

      <div className="grid gap-3">
        {results?.map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <a
                href={`https://www.youtube.com/channel/${r.youtube_channel_id}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink hover:underline"
              >
                {r.channel_title}
              </a>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                <span>{r.subscriber_count ?? '—'} suscriptores</span>
                <span>·</span>
                <span>{Math.round(r.avg_recent_views)} vistas prom.</span>
                <span>·</span>
                <span>{Math.round(r.shorts_ratio * 100)}% Shorts</span>
                <span>·</span>
                <span>{r.upload_velocity_per_week.toFixed(1)} videos/semana</span>
              </div>
            </div>
            <CircularProgress value={r.monetization_score} label="puntaje" />
          </Card>
        ))}
      </div>
    </div>
  )
}
