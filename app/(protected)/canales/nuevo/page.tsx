'use client'

import { useState } from 'react'
import { createChannel, prefillChannelFromUrl } from '../actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'

export default function NuevoCanalPage() {
  const [error, setError] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [autofillLoading, setAutofillLoading] = useState(false)
  const [autofillError, setAutofillError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [targetCountry, setTargetCountry] = useState('')
  const [variationRules, setVariationRules] = useState('')

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
    if (result.target_country) setTargetCountry(result.target_country)
    if (result.target_language) setTargetLanguage(result.target_language)
    setNiche(result.niche)
    setVariationRules(result.variation_rules)
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
            Si el canal ya existe en YouTube, esto llena nombre, país e idioma con datos reales, y sugiere un nicho y reglas de variación — revísalos y ajústalos antes de guardar.
          </p>
        </Field>
        {autofillError && <p className="text-sm font-medium text-accent-coral-ink" role="alert">{autofillError}</p>}
      </Card>

      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Nombre del canal">
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
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
            <Input name="brand_voice_id" />
          </Field>
          <Field label="Referencia de estilo visual (opcional)">
            <Textarea name="visual_style_reference" />
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
