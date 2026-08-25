import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center rounded-control px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none'
  const variants: Record<Variant, string> = {
    primary: 'bg-accent-lime text-accent-lime-ink hover:brightness-95',
    secondary: 'bg-surface text-ink border border-border hover:bg-surface-hover',
  }

  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}
