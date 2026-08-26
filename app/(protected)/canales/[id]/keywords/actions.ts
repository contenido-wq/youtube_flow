'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { getKeywordData } from '@/lib/keywords/keywords-everywhere-client'
import { generateTitles } from '@/lib/titles/generate-titles'

export async function researchTopic(topic: string) {
  // Server actions are independently callable HTTP endpoints regardless of
  // which page rendered them — the (protected) layout only gates page
  // rendering, not this action. Without this check, anyone who finds the
  // action's endpoint could burn through the team's Anthropic and Keywords
  // Everywhere credits without ever logging in.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { keywordData: [], titles: [], error: 'No autenticado' }

  const keywordData = await getKeywordData(process.env.KEYWORDS_EVERYWHERE_API_KEY!, [topic])
  const anthropic = createAnthropicClient()
  const titles = await generateTitles(anthropic, topic, keywordData)

  return { keywordData, titles, error: null }
}
