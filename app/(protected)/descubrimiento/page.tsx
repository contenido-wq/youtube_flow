'use client'

import { useState } from 'react'
import { runDiscovery } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

export default function DescubrimientoPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await runDiscovery({
      query: formData.get('query') as string,
      maxAgeDays: Number(formData.get('maxAgeDays')),
      maxSubscribers: Number(formData.get('maxSubscribers')),
      minAvgViews: Number(formData.get('minAvgViews')),
    })
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Nueva búsqueda de scouting</h1>
      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Nicho o palabra clave">
            <Input name="query" placeholder="ej. finanzas personales" required />
          </Field>
          <Field label="Edad máxima del canal (días)">
            <Input name="maxAgeDays" type="number" defaultValue={90} required />
          </Field>
          <Field label="Suscriptores máximos">
            <Input name="maxSubscribers" type="number" defaultValue={100000} required />
          </Field>
          <Field label="Vistas promedio mínimas por video">
            <Input name="minAvgViews" type="number" defaultValue={1000} required />
          </Field>
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Buscar'}</Button>
        </form>
      </Card>
    </div>
  )
}
