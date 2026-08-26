'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  IconActivity,
  IconGrid,
  IconRadar,
  IconUsers,
  IconLogout,
  IconFileText,
  IconCopy,
  IconHash,
  IconImage,
} from '@/components/ui/icons'
import { createClient } from '@/lib/supabase/client'

const QUICK_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconActivity },
  { href: '/descubrimiento', label: 'Descubrimiento', Icon: IconRadar },
  { href: '/equipo', label: 'Equipo', Icon: IconUsers },
]

const MENU_ITEMS = [
  { href: '/canales', label: 'Canales', description: 'Ver todos tus canales', Icon: IconGrid },
  { href: '/canales/nuevo', label: 'Nuevo canal', description: 'Crear uno desde cero, o pegando su URL de YouTube', Icon: IconGrid },
  { href: '/guiones', label: 'Guiones', description: 'Todos los guiones generados, de cualquier canal', Icon: IconFileText },
  { href: '/guiones', label: 'Miniaturas', description: 'Genera miniaturas con IA desde el detalle de cada guion', Icon: IconImage },
  { href: '/descubrimiento', label: 'Descubrimiento', description: 'Scouting de canales ganadores para modelar', Icon: IconRadar },
  { href: '/canales', label: 'Clonar canal', description: 'Elige un canal para generar un plan de clonación', Icon: IconCopy },
  { href: '/canales', label: 'Keywords y títulos', description: 'Elige un canal para investigar un tema', Icon: IconHash },
  { href: '/equipo', label: 'Equipo', description: 'Roles y miembros del equipo', Icon: IconUsers },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}

      <nav
        aria-label="Navegación principal"
        className="fixed left-4 top-4 bottom-4 z-20 flex w-16 flex-col items-center justify-between rounded-[32px] bg-sidebar py-5"
      >
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Youtube Flow" width={40} height={40} className="mb-2 h-10 w-10 rounded-2xl" priority />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Todas las opciones"
              title="Todas las opciones"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                menuOpen ? 'bg-white text-sidebar' : 'bg-sidebar-icon text-white/70 hover:text-white'
              }`}
            >
              <IconGrid />
            </button>

            {menuOpen && (
              <div className="absolute left-14 top-0 z-20 w-72 rounded-card bg-surface p-2 shadow-[0_1px_2px_rgba(22,23,26,0.04),0_12px_24px_-12px_rgba(22,23,26,0.24)]">
                {MENU_ITEMS.map(({ href, label, description, Icon }, index) => (
                  <Link
                    key={`${href}-${index}`}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="mt-0.5 text-ink">
                      <Icon width={18} height={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{label}</span>
                      <span className="block text-xs text-muted">{description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {QUICK_NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-white text-sidebar' : 'bg-sidebar-icon text-white/70 hover:text-white'
                }`}
              >
                <Icon />
              </Link>
            )
          })}
        </div>

        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-icon text-white/70 transition-colors hover:text-white"
        >
          <IconLogout />
        </button>
      </nav>
    </>
  )
}
