import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

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
      <h1>Resultados — {run.status}</h1>
      {run.error_message && <p role="alert">{run.error_message}</p>}
      <table>
        <thead>
          <tr>
            <th>Canal</th>
            <th>Puntaje</th>
            <th>Suscriptores</th>
            <th>Vistas prom.</th>
            <th>% Shorts</th>
            <th>Videos/semana</th>
          </tr>
        </thead>
        <tbody>
          {results?.map((r) => (
            <tr key={r.id}>
              <td>
                <a href={`https://www.youtube.com/channel/${r.youtube_channel_id}`} target="_blank" rel="noreferrer">
                  {r.channel_title}
                </a>
              </td>
              <td>{r.monetization_score}</td>
              <td>{r.subscriber_count ?? '—'}</td>
              <td>{Math.round(r.avg_recent_views)}</td>
              <td>{Math.round(r.shorts_ratio * 100)}%</td>
              <td>{r.upload_velocity_per_week.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
