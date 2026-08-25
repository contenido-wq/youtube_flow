import { z } from 'zod'

export const channelSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  niche: z.string().min(1, 'El nicho es obligatorio'),
  target_language: z.string().length(2, 'Usa un código de idioma de 2 letras (ej. "es")'),
  target_country: z.string().optional(),
  brand_voice_id: z.string().optional(),
  visual_style_reference: z.string().optional(),
  variation_rules: z
    .string()
    .min(20, 'Describe reglas de variación concretas (mínimo 20 caracteres) — esto controla el riesgo de "Inauthentic Content"'),
})

export type ChannelInput = z.infer<typeof channelSchema>
