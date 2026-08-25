import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateChannel } from '../actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { IconCopy, IconHash, IconFileText } from '@/components/ui/icons'

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Editar canal</h1>
        <div className="flex gap-2">
          <Link href={`/canales/${id}/guiones`}>
            <Button variant="secondary" className="gap-2">
              <IconFileText width={16} height={16} /> Guiones
            </Button>
          </Link>
          <Link href={`/canales/${id}/clonar`}>
            <Button variant="secondary" className="gap-2">
              <IconCopy width={16} height={16} /> Clonar canal
            </Button>
          </Link>
          <Link href={`/canales/${id}/keywords`}>
            <Button variant="secondary" className="gap-2">
              <IconHash width={16} height={16} /> Keywords y títulos
            </Button>
          </Link>
        </div>
      </div>
      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Nombre del canal">
            <Input name="name" defaultValue={channel.name} required />
          </Field>
          <Field label="Nicho">
            <Input name="niche" defaultValue={channel.niche} required />
          </Field>
          <Field label="Idioma">
            <Input name="target_language" defaultValue={channel.target_language} required />
          </Field>
          <Field label="País">
            <Input name="target_country" defaultValue={channel.target_country ?? ''} />
          </Field>
          <Field label="Voz de marca">
            <Input name="brand_voice_id" defaultValue={channel.brand_voice_id ?? ''} />
          </Field>
          <Field label="Referencia de estilo visual">
            <Textarea name="visual_style_reference" defaultValue={channel.visual_style_reference ?? ''} />
          </Field>
          <Field label="Reglas de variación obligatoria">
            <Textarea name="variation_rules" defaultValue={channel.variation_rules} required />
          </Field>
          <Button type="submit">Guardar cambios</Button>
        </form>
      </Card>
    </div>
  )
}
