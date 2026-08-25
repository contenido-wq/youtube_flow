import { createClient } from '@/lib/supabase/server'
import { runClonePlan } from './actions'

export default async function ClonarCanalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ planId?: string }>
}) {
  const { id: channelId } = await params
  const { planId } = await searchParams
  const supabase = await createClient()

  async function handleSubmit(formData: FormData) {
    'use server'
    await runClonePlan(
      channelId,
      formData.get('sourceYoutubeChannelId') as string,
      formData.get('sourceChannelTitle') as string
    )
  }

  const items = planId
    ? (await supabase.from('clone_plan_items').select('*').eq('clone_plan_id', planId)).data
    : null

  return (
    <div>
      <h1>Clonar canal</h1>
      <form action={handleSubmit}>
        <input name="sourceYoutubeChannelId" placeholder="ID del canal de YouTube (ej. UC...)" required />
        <input name="sourceChannelTitle" placeholder="Nombre del canal fuente" required />
        <button type="submit">Generar plan de clonación</button>
      </form>

      {items && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.proposed_topic}</strong> — {item.proposed_angle}
              <br />
              <small>Inspirado en: &quot;{item.source_video_title}&quot; ({item.source_video_views} vistas)</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
