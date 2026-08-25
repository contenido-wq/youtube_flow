import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(22,23,26,0.04),0_12px_24px_-12px_rgba(22,23,26,0.12)] ${className}`}>
      {children}
    </div>
  )
}
