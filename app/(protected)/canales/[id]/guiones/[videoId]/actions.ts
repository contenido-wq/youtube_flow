'use server'

import { splitIntoCoherentBlocks } from '@/lib/scripts/block-splitter'

export async function splitScript(scriptContent: string, targetBlockSize: number) {
  return splitIntoCoherentBlocks(scriptContent, targetBlockSize)
}
