'use server'

import { createClient } from '@/lib/supabase/server'
import { channelSchema, type ChannelInput } from '@/lib/channels/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createChannel(input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('channels').insert({ ...parsed.data, created_by: user.id })
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}

export async function updateChannel(id: string, input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('channels').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}
