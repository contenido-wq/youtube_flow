'use client'

import { useState } from 'react'
import { createChannel } from '../actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'

export default function NuevoCanalPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await createChannel({
      name: formData.get('name') as string,
      niche: formData.get('niche') as string,
      target_language: formData.get('target_language') as string,
      target_country: (formData.get('target_country') as string) || undefined,
      brand_voice_id: (formData.get('brand_voice_id') as string) || undefined,
      visual_style_reference: (formData.get('visual_style_reference') as string) || undefined,
      variation_rules: formData.get('variation_rules') as string,
    })
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Nuevo canal</h1>
      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Nombre del canal">
            <Input name="name" required />
          </Field>
          <Field label="Nicho">
            <Input name="niche" required />
          </Field>
          <Field label="Idioma (ej. es)">
            <Input name="target_language" defaultValue="es" required />
          </Field>
          <Field label="País (opcional)">
            <Input name="target_country" />
          </Field>
          <Field label="Voz de marca (opcional)">
            <Input name="brand_voice_id" />
          </Field>
          <Field label="Referencia de estilo visual (opcional)">
            <Textarea name="visual_style_reference" />
          </Field>
          <Field label="Reglas de variación obligatoria">
            <Textarea name="variation_rules" required />
          </Field>
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit">Crear canal</Button>
        </form>
      </Card>
    </div>
  )
}
