import { describe, it, expect } from 'vitest'
import { OFFICIAL_CHANNEL_HANDLES } from './official-sources'

describe('OFFICIAL_CHANNEL_HANDLES', () => {
  it('lista handles de YouTube (@handle), sin duplicados', () => {
    expect(OFFICIAL_CHANNEL_HANDLES.length).toBeGreaterThan(0)
    for (const handle of OFFICIAL_CHANNEL_HANDLES) {
      expect(handle.startsWith('@')).toBe(true)
    }
    expect(new Set(OFFICIAL_CHANNEL_HANDLES).size).toBe(OFFICIAL_CHANNEL_HANDLES.length)
  })
})
