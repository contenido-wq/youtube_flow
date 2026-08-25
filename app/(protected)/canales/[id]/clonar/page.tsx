import { createClient } from '@/lib/supabase/server'
import { runClonePlan } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

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
      <h1 className="mb-6 text-2xl font-bold text-ink">Clonar canal</h1>
      <Card className="mb-6 max-w-xl">
        <form action={handleSubmit}>
          <Field label="ID del canal de YouTube fuente">
            <Input name="sourceYoutubeChannelId" placeholder="UC..." required />
          </Field>
          <Field label="Nombre del canal fuente">
            <Input name="sourceChannelTitle" required />
          </Field>
          <Button type="submit">Generar plan de clonación</Button>
        </form>
      </Card>

      {items && (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{item.proposed_topic}</p>
                <Badge tone="lime">{item.source_video_views} vistas</Badge>
              </div>
              <p className="mb-2 text-sm text-ink">{item.proposed_angle}</p>
              <p className="text-xs text-muted">Inspirado en: &quot;{item.source_video_title}&quot;</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
