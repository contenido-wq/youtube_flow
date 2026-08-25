'use client'

import { useState } from 'react'
import { researchTopic } from './actions'
import type { KeywordData } from '@/lib/keywords/keywords-everywhere-client'

export default function KeywordsPage() {
  const [topic, setTopic] = useState('')
  const [keywordData, setKeywordData] = useState<KeywordData[]>([])
  const [titles, setTitles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await researchTopic(topic)
    setKeywordData(result.keywordData)
    setTitles(result.titles)
    setLoading(false)
  }

  return (
    <div>
      <h1>Keywords y títulos</h1>
      <form onSubmit={handleSubmit}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema del video" required />
        <button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Investigar'}</button>
      </form>

      {keywordData.length > 0 && (
        <>
          <h2>Keywords</h2>
          <ul>
            {keywordData.map((k) => (
              <li key={k.keyword}>{k.keyword} — volumen: {k.volume}, competencia: {k.competition}</li>
            ))}
          </ul>
        </>
      )}

      {titles.length > 0 && (
        <>
          <h2>Títulos propuestos</h2>
          <ul>
            {titles.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}
