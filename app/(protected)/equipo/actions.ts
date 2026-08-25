'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTeamMemberRole(memberId: string, role: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('team_members').update({ role }).eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/equipo')
  return { error: null }
}
