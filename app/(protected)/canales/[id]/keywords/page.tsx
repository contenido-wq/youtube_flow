'use client'

import { useState } from 'react'
import { researchTopic } from './actions'
import type { KeywordData } from '@/lib/keywords/keywords-everywhere-client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

export default function KeywordsPage() {
  const [topic, setTopic] = useState('')
  const [keywordData, setKeywordData] = useState<KeywordData[]>([])
  const [titles, setTitles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await researchTopic(topic)
    if (result.error) {
      setError(result.error)
    } else {
      setKeywordData(result.keywordData)
      setTitles(result.titles)
    }
    setLoading(false)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Keywords y títulos</h1>
      <Card className="mb-6 max-w-xl">
        <form onSubmit={handleSubmit}>
          <Field label="Tema del video">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} required />
          </Field>
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Investigar'}</Button>
        </form>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {keywordData.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Keywords</h2>
            <div className="flex flex-col gap-2">
              {keywordData.map((k) => (
                <div key={k.keyword} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{k.keyword}</span>
                  <Badge tone="sky">{k.volume} / mes</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {titles.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Títulos propuestos</h2>
            <ul className="flex flex-col gap-2 text-sm text-ink">
              {titles.map((t) => (
                <li key={t} className="rounded-control bg-canvas px-3 py-2">{t}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
