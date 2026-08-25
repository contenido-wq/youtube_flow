'use server'

import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { getKeywordData } from '@/lib/keywords/keywords-everywhere-client'
import { generateTitles } from '@/lib/titles/generate-titles'

export async function researchTopic(topic: string) {
  const keywordData = await getKeywordData(process.env.KEYWORDS_EVERYWHERE_API_KEY!, [topic])
  const anthropic = createAnthropicClient()
  const titles = await generateTitles(anthropic, topic, keywordData)

  return { keywordData, titles }
}
