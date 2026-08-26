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
  IconBook,
  IconMic,
} from '@/components/ui/icons'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'

type NavItem = {
  href: string | null
  label: string
  name: string
  description: string
  Icon: typeof IconActivity
  quickAccess?: boolean
  comingSoon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    name: 'Dashboard',
    description: 'Tu resumen del día: canales, guiones y las noticias del sector en un solo lugar.',
    Icon: IconActivity,
    quickAccess: true,
  },
  {
    href: '/descubrimiento',
    label: 'Descubrimiento',
    name: 'Discovery Engine',
    description: 'Descubre videos virales y nichos rentables. Analiza tendencias en tiempo real.',
    Icon: IconRadar,
    quickAccess: true,
  },
  {
    href: '/equipo',
    label: 'Equipo',
    name: 'Team Hub',
    description: 'Gestiona los roles y miembros de tu equipo.',
    Icon: IconUsers,
    quickAccess: true,
  },
  {
    href: '/canales',
    label: 'Canales',
    name: 'Channel Hub',
    description: 'Administra todos tus canales y revisa el progreso de cada uno.',
    Icon: IconGrid,
  },
  {
    href: '/canales/nuevo',
    label: 'Nuevo canal',
    name: 'Canal Creator',
    description: 'Crea un canal desde cero, o pega su URL de YouTube para autocompletar todo.',
    Icon: IconGrid,
  },
  {
    href: '/guiones',
    label: 'Guiones',
    name: 'Script Lab',
    description: 'Genera guiones para YouTube con IA en segundos. Configura duración, estilo y más.',
    Icon: IconFileText,
  },
  {
    href: '/guiones',
    label: 'Miniaturas',
    name: 'Generador de Miniaturas',
    description: 'Crea miniaturas profesionales con IA. Sube referencias y personaliza el resultado.',
    Icon: IconImage,
  },
  {
    href: '/canales',
    label: 'Clonar canal',
    name: 'Clone Studio',
    description: 'Elige un canal ganador y genera un plan de clonación con IA.',
    Icon: IconCopy,
  },
  {
    href: '/canales',
    label: 'Keywords y títulos',
    name: 'Keyword Finder',
    description: 'Investiga keywords y genera títulos virales para cualquier tema.',
    Icon: IconHash,
  },
  {
    href: null,
    label: 'Recursos',
    name: 'Recursos',
    description: 'Accede a guías y material exclusivo por la compra de tu plan.',
    Icon: IconBook,
    comingSoon: true,
  },
  {
    href: null,
    label: 'Voice Lab',
    name: 'Voice Lab',
    description: 'Convierte texto a voz con voces ultra-realistas (próximamente).',
    Icon: IconMic,
    comingSoon: true,
  },
]

function NavHoverCard({ name, description, align = 'left' }: { name: string; description: string; align?: 'left' | 'right' }) {
  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-30 w-64 -translate-y-1/2 rounded-card bg-surface p-3 opacity-0 shadow-[0_1px_2px_rgba(22,23,26,0.04),0_12px_24px_-12px_rgba(22,23,26,0.24)] transition-opacity duration-150 group-hover:opacity-100 ${
        align === 'left' ? 'left-full ml-3' : 'right-full mr-3'
      }`}
    >
      <p className="text-sm font-semibold text-ink">{name}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  )
}

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

  const quickAccessItems = NAV_ITEMS.filter((item) => item.quickAccess)

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
                {NAV_ITEMS.map(({ href, label, name, description, Icon, comingSoon }, index) => {
                  const content = (
                    <>
                      <span className="mt-0.5 text-ink">
                        <Icon width={18} height={18} />
                      </span>
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="block text-sm font-semibold text-ink">{name}</span>
                          {comingSoon && <Badge tone="neutral">Próximamente</Badge>}
                        </span>
                        <span className="block text-xs text-muted">{description}</span>
                      </span>
                    </>
                  )

                  if (!href) {
                    return (
                      <div
                        key={`${label}-${index}`}
                        className="flex cursor-default items-start gap-3 rounded-control px-3 py-2.5 text-left opacity-60"
                      >
                        {content}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={`${href}-${index}`}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                    >
                      {content}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {quickAccessItems.map(({ href, label, name, description, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <div key={href} className="group relative">
                <Link
                  href={href!}
                  aria-label={label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-white text-sidebar' : 'bg-sidebar-icon text-white/70 hover:text-white'
                  }`}
                >
                  <Icon />
                </Link>
                <NavHoverCard name={name} description={description} />
              </div>
            )
          })}
        </div>

        <div className="group relative">
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-icon text-white/70 transition-colors hover:text-white"
          >
            <IconLogout />
          </button>
          <NavHoverCard name="Cerrar sesión" description="Salir de tu cuenta de equipo en este dispositivo." />
        </div>
      </nav>
    </>
  )
}
