'use client'

import { useState } from 'react'
import { createChannel } from '../actions'

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
    <form action={handleSubmit}>
      <h1>Nuevo canal</h1>
      <input name="name" placeholder="Nombre del canal" required />
      <input name="niche" placeholder="Nicho" required />
      <input name="target_language" placeholder="Idioma (ej. es)" defaultValue="es" required />
      <input name="target_country" placeholder="País (opcional)" />
      <input name="brand_voice_id" placeholder="Voz de marca (opcional)" />
      <textarea name="visual_style_reference" placeholder="Referencia de estilo visual (opcional)" />
      <textarea name="variation_rules" placeholder="Reglas de variación obligatoria" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Crear canal</button>
    </form>
  )
}
