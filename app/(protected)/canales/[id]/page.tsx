import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateChannel } from '../actions'

export default async function EditarCanalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: channel } = await supabase.from('channels').select('*').eq('id', id).single()

  if (!channel) notFound()

  async function handleSubmit(formData: FormData) {
    'use server'
    await updateChannel(id, {
      name: formData.get('name') as string,
      niche: formData.get('niche') as string,
      target_language: formData.get('target_language') as string,
      target_country: (formData.get('target_country') as string) || undefined,
      brand_voice_id: (formData.get('brand_voice_id') as string) || undefined,
      visual_style_reference: (formData.get('visual_style_reference') as string) || undefined,
      variation_rules: formData.get('variation_rules') as string,
    })
  }

  return (
    <form action={handleSubmit}>
      <h1>Editar canal</h1>
      <input name="name" defaultValue={channel.name} required />
      <input name="niche" defaultValue={channel.niche} required />
      <input name="target_language" defaultValue={channel.target_language} required />
      <input name="target_country" defaultValue={channel.target_country ?? ''} />
      <input name="brand_voice_id" defaultValue={channel.brand_voice_id ?? ''} />
      <textarea name="visual_style_reference" defaultValue={channel.visual_style_reference ?? ''} />
      <textarea name="variation_rules" defaultValue={channel.variation_rules} required />
      <button type="submit">Guardar cambios</button>
    </form>
  )
}
