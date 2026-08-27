'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { splitScript, generateThumbnail } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

interface VideoRow {
  topic: string
  status: string
  error_message: string | null
  script_content: string | null
  seo_titles: string[] | null
  seo_description: string | null
  seo_tags: string[] | null
  seo_pinned_comment: string | null
  seo_thumbnail_phrases: string[] | null
  seo_image_prompts: string[] | null
  thumbnail_urls: string[] | null
}

interface ThumbnailVariation {
  prompt: string
  loading: boolean
  error: string | null
}

export default function GuionDetallePage() {
  const params = useParams<{ videoId: string }>()
  const [video, setVideo] = useState<VideoRow | null>(null)
  const [blockSize, setBlockSize] = useState(3000)
  const [blocks, setBlocks] = useState<string[]>([])
  const [variations, setVariations] = useState<ThumbnailVariation[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('videos')
      .select('*')
      .eq('id', params.videoId)
      .single()
      .then(({ data }) => {
        setVideo(data)
        setVariations((data?.seo_image_prompts ?? []).map((prompt: string) => ({ prompt, loading: false, error: null })))
        setThumbnailUrls(data?.thumbnail_urls ?? [])
      })
  }, [params.videoId])

  async function handleSplit() {
    if (!video?.script_content) return
    setBlocks(await splitScript(video.script_content, blockSize))
  }

  function updateVariation(index: number, patch: Partial<ThumbnailVariation>) {
    setVariations((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  async function handleGenerateThumbnail(index: number) {
    const variation = variations[index]
    if (!variation?.prompt) return

    updateVariation(index, { loading: true, error: null })
    const result = await generateThumbnail(params.videoId, variation.prompt)
    updateVariation(index, { loading: false, error: result.error })
    if (result.url) setThumbnailUrls((prev) => [...prev, result.url as string])
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
            <h2 className="mb-3 text-sm font-semibold text-muted">Títulos</h2>
            <ol className="flex flex-col gap-2">
              {video.seo_titles?.map((title, i) => (
                <li key={i} className="rounded-control bg-canvas px-3 py-2 text-sm text-ink">
                  <span className="mr-2 font-semibold text-muted">{i + 1}.</span>
                  {title}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">SEO</h2>
            <p className="mb-2 text-sm text-ink">{video.seo_description}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {video.seo_tags?.map((t) => <Badge key={t} tone="sky">{t}</Badge>)}
            </div>
            <p className="mb-2 text-sm text-ink"><strong>Comentario fijado:</strong> {video.seo_pinned_comment}</p>
            <div className="flex flex-wrap gap-2">
              {video.seo_thumbnail_phrases?.map((p) => <Badge key={p} tone="sky">{p}</Badge>)}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Miniaturas</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {variations.map((variation, i) => (
                <div key={i} className="rounded-control bg-canvas p-3">
                  <p className="mb-2 text-xs font-semibold text-muted">Variación {i + 1}</p>
                  <Field label="Prompt de imagen (editable)">
                    <Textarea
                      value={variation.prompt}
                      onChange={(e) => updateVariation(i, { prompt: e.target.value })}
                      className="min-h-24"
                    />
                  </Field>
                  {variation.error && (
                    <p className="mb-2 text-sm font-medium text-accent-coral-ink" role="alert">{variation.error}</p>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => handleGenerateThumbnail(i)}
                    disabled={variation.loading || !variation.prompt}
                  >
                    {variation.loading ? 'Generando...' : '+ Generar miniatura'}
                  </Button>
                </div>
              ))}
            </div>

            {thumbnailUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {thumbnailUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="Miniatura generada" className="aspect-video w-full rounded-control object-cover" />
                ))}
              </div>
            )}
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
