'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { runClonePlan } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

interface ClonePlanItemRow {
  id: string
  proposed_topic: string
  proposed_angle: string
  source_video_title: string
  source_video_views: number
}

export default function ClonarCanalPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get('planId')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ClonePlanItemRow[] | null>(null)

  useEffect(() => {
    if (!planId) return
    const supabase = createClient()
    supabase
      .from('clone_plan_items')
      .select('*')
      .eq('clone_plan_id', planId)
      .then(({ data }) => setItems(data))
  }, [planId])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await runClonePlan(params.id, formData.get('sourceUrl') as string)
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Clonar canal</h1>
      <Card className="mb-6 max-w-xl">
        <form action={handleSubmit}>
          <Field label="URL del canal de YouTube a clonar">
            <Input
              name="sourceUrl"
              placeholder="https://www.youtube.com/@NombreDelCanal"
              required
            />
          </Field>
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Generando...' : 'Generar plan de clonación'}</Button>
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
