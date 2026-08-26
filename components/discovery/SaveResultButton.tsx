'use client'

import { useState } from 'react'
import { toggleSavedResult } from '@/app/(protected)/descubrimiento/actions'
import { Button } from '@/components/ui/Button'
import { IconStar } from '@/components/ui/icons'

export function SaveResultButton({ resultId, initialSaved }: { resultId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const next = !saved
    setSaved(next)
    setLoading(true)
    const result = await toggleSavedResult(resultId, next)
    setLoading(false)
    if (result.error) setSaved(!next)
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={loading} className="shrink-0">
      <IconStar
        width={16}
        height={16}
        className="mr-1.5"
        fill={saved ? 'currentColor' : 'none'}
        style={{ color: saved ? 'var(--color-accent-lime)' : undefined }}
      />
      {saved ? 'Guardado' : 'Guardar'}
    </Button>
  )
}
