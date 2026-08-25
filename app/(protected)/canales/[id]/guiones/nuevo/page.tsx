'use client'

import { useState } from 'react'
import { createVideo } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useParams } from 'next/navigation'

export default function NuevoGuionPage() {
  const params = useParams<{ id: string }>()
  const [style, setStyle] = useState<'estandar' | 'personalizado'>('estandar')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createVideo(params.id, {
      topic: formData.get('topic') as string,
      targetDurationSeconds: Number(formData.get('targetDurationMinutes')) * 60,
      style,
      referenceTranscript: (formData.get('referenceTranscript') as string) || undefined,
    })
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Nuevo guion</h1>
      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Tema del video">
            <Input name="topic" required />
          </Field>
          <Field label="Duración objetivo (minutos)">
            <Input name="targetDurationMinutes" type="number" step="0.5" defaultValue={8} required />
          </Field>
          <Field label="Estilo">
            <Select value={style} onChange={(e) => setStyle(e.target.value as 'estandar' | 'personalizado')}>
              <option value="estandar">Estándar</option>
              <option value="personalizado">Personalizado (replicar una transcripción de referencia)</option>
            </Select>
          </Field>
          {style === 'personalizado' && (
            <Field label="Transcripción de referencia">
              <Textarea name="referenceTranscript" required className="min-h-40" />
            </Field>
          )}
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Generando...' : 'Generar guion'}</Button>
        </form>
      </Card>
    </div>
  )
}
