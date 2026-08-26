'use client'

import { useState } from 'react'
import { createChannel, prefillChannelFromUrl } from '../actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'

interface CloneMetrics {
  subscriberCount: number
  viewCount: number
  videoCount: number
  uploadCadencePerWeek: number
  avgViews: number
  topOutlier: { title: string; viewCount: number } | null
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </Card>
  )
}

const numberFormatter = new Intl.NumberFormat('es')

export default function NuevoCanalPage() {
  const [error, setError] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [autofillLoading, setAutofillLoading] = useState(false)
  const [autofillError, setAutofillError] = useState<string | null>(null)
  const [originalChannelTitle, setOriginalChannelTitle] = useState('')
  const [metrics, setMetrics] = useState<CloneMetrics | null>(null)

  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [targetCountry, setTargetCountry] = useState('')
  const [variationRules, setVariationRules] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [visualStyleReference, setVisualStyleReference] = useState('')

  async function handleAutofill() {
    if (!sourceUrl) return
    setAutofillLoading(true)
    setAutofillError(null)
    const result = await prefillChannelFromUrl(sourceUrl)
    setAutofillLoading(false)

    if (result.error) {
      setAutofillError(result.error)
      return
    }

    setName(result.name)
    setOriginalChannelTitle(result.originalChannelTitle)
    if (result.target_country) setTargetCountry(result.target_country)
    if (result.target_language) setTargetLanguage(result.target_language)
    setNiche(result.niche)
    setVariationRules(result.variation_rules)
    setBrandVoice(result.brand_voice_id)
    setVisualStyleReference(result.visual_style_reference)
    setMetrics(result.metrics)
  }

  async function handleSubmit(formData: FormData) {
    const result = await createChannel({
      name,
      niche,
      target_language: targetLanguage,
      target_country: targetCountry || undefined,
      brand_voice_id: (formData.get('brand_voice_id') as string) || undefined,
      visual_style_reference: (formData.get('visual_style_reference') as string) || undefined,
      variation_rules: variationRules,
    })
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Nuevo canal</h1>

      <Card className="mb-6 max-w-xl">
        <Field label="URL del canal en YouTube (opcional)">
          <div className="flex gap-2">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.youtube.com/@TuCanal"
            />
            <Button type="button" variant="secondary" onClick={handleAutofill} disabled={autofillLoading || !sourceUrl}>
              {autofillLoading ? 'Buscando...' : 'Autocompletar'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Si el canal ya existe en YouTube, esto trae sus métricas, sugiere un nombre nuevo diferenciado (para no duplicar la marca original), y llena nicho, país, idioma, voz de marca y estilo visual — revísalos y ajústalos antes de guardar.
          </p>
        </Field>
        {autofillError && <p className="text-sm font-medium text-accent-coral-ink" role="alert">{autofillError}</p>}
      </Card>

      {metrics && (
        <Card className="mb-6 max-w-xl">
          <h2 className="mb-1 text-sm font-semibold text-ink">
            Métricas de &quot;{originalChannelTitle}&quot; — ¿vale la pena clonarlo?
          </h2>
          <p className="mb-4 text-xs text-muted">Basado en su catálogo de videos más reciente.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Suscriptores" value={numberFormatter.format(metrics.subscriberCount)} />
            <MetricCard label="Vistas totales" value={numberFormatter.format(metrics.viewCount)} />
            <MetricCard label="Videos publicados" value={numberFormatter.format(metrics.videoCount)} />
            <MetricCard label="Cadencia / semana" value={metrics.uploadCadencePerWeek.toFixed(1)} />
            <MetricCard label="Promedio de vistas" value={numberFormatter.format(Math.round(metrics.avgViews))} />
            <MetricCard
              label="Video más viral"
              value={metrics.topOutlier ? numberFormatter.format(metrics.topOutlier.viewCount) : '—'}
            />
          </div>
          {metrics.topOutlier && (
            <p className="mt-3 text-xs text-muted">
              El video que más se disparó fue &quot;{metrics.topOutlier.title}&quot;.
            </p>
          )}
        </Card>
      )}

      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Nombre del canal">
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {originalChannelTitle && (
            <p className="-mt-3 mb-4 text-xs text-muted">
              Canal original: &quot;{originalChannelTitle}&quot; — usa un nombre distinto para no duplicar esa marca.
            </p>
          )}
          <Field label="Nicho">
            <Input name="niche" value={niche} onChange={(e) => setNiche(e.target.value)} required />
          </Field>
          <Field label="Idioma (ej. es)">
            <Input name="target_language" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} required />
          </Field>
          <Field label="País (opcional)">
            <Input name="target_country" value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)} />
          </Field>
          <Field label="Voz de marca (opcional)">
            <Input name="brand_voice_id" value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} />
          </Field>
          <Field label="Referencia de estilo visual (opcional)">
            <Textarea name="visual_style_reference" value={visualStyleReference} onChange={(e) => setVisualStyleReference(e.target.value)} />
          </Field>
          <Field label="Reglas de variación obligatoria">
            <Textarea name="variation_rules" value={variationRules} onChange={(e) => setVariationRules(e.target.value)} required />
          </Field>
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit">Crear canal</Button>
        </form>
      </Card>
    </div>
  )
}
