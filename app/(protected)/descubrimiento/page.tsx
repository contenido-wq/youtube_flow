'use client'

import { useState } from 'react'
import { runDiscovery } from './actions'

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
    <form action={handleSubmit}>
      <h1>Nueva búsqueda de scouting</h1>
      <input name="query" placeholder="Nicho o palabra clave (ej. finanzas personales)" required />
      <label>
        Edad máxima del canal (días)
        <input name="maxAgeDays" type="number" defaultValue={90} required />
      </label>
      <label>
        Suscriptores máximos
        <input name="maxSubscribers" type="number" defaultValue={100000} required />
      </label>
      <label>
        Vistas promedio mínimas por video
        <input name="minAvgViews" type="number" defaultValue={1000} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Buscar'}</button>
    </form>
  )
}
