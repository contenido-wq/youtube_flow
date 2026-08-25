import type { ReactNode } from 'react'

type Tone = 'lime' | 'sky' | 'coral' | 'neutral'

const tones: Record<Tone, string> = {
  lime: 'bg-accent-lime text-accent-lime-ink',
  sky: 'bg-accent-sky text-accent-sky-ink',
  coral: 'bg-accent-coral text-accent-coral-ink',
  neutral: 'bg-sidebar-icon text-white',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
