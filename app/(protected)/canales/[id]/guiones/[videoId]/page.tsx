'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { splitScript } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

interface VideoRow {
  topic: string
  status: string
  error_message: string | null
  script_content: string | null
  seo_description: string | null
  seo_tags: string[] | null
  seo_pinned_comment: string | null
  seo_thumbnail_phrases: string[] | null
  seo_image_prompt: string | null
}

export default function GuionDetallePage() {
  const params = useParams<{ videoId: string }>()
  const [video, setVideo] = useState<VideoRow | null>(null)
  const [blockSize, setBlockSize] = useState(3000)
  const [blocks, setBlocks] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('videos')
      .select('*')
      .eq('id', params.videoId)
      .single()
      .then(({ data }) => setVideo(data))
  }, [params.videoId])

  async function handleSplit() {
    if (!video?.script_content) return
    setBlocks(await splitScript(video.script_content, blockSize))
  }

  if (!video) return <p className="text-muted">Cargando...</p>

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{video.topic}</h1>
        <Badge tone={video.status === 'scripted' ? 'lime' : video.status === 'failed' ? 'coral' : 'sky'}>{video.status}</Badge>
      </div>

      {video.error_message && (
        <Card className="mb-4"><p className="text-sm font-medium text-accent-coral-ink" role="alert">{video.error_message}</p></Card>
      )}

      {video.script_content && (
        <div className="grid gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Guion</h2>
            <p className="whitespace-pre-wrap text-sm text-ink">{video.script_content}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">SEO</h2>
            <p className="mb-2 text-sm text-ink">{video.seo_description}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {video.seo_tags?.map((t) => <Badge key={t} tone="sky">{t}</Badge>)}
            </div>
            <p className="mb-2 text-sm text-ink"><strong>Comentario fijado:</strong> {video.seo_pinned_comment}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {video.seo_thumbnail_phrases?.map((p) => <Badge key={p} tone="coral">{p}</Badge>)}
            </div>
            <p className="text-sm text-muted"><strong>Prompt de imagen:</strong> {video.seo_image_prompt}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Dividir para locución</h2>
            <div className="mb-4 flex items-end gap-3">
              <Field label="Tamaño de bloque (caracteres)">
                <Input type="number" value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))} />
              </Field>
              <Button variant="secondary" onClick={handleSplit}>Dividir</Button>
            </div>
            {blocks.length > 0 && (
              <ol className="flex flex-col gap-2">
                {blocks.map((b, i) => (
                  <li key={i} className="rounded-control bg-canvas p-3 text-sm text-ink">
                    <span className="mb-1 block text-xs font-semibold text-muted">Bloque {i + 1} ({b.length} caracteres)</span>
                    {b}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
