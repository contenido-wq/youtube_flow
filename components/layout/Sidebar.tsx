'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { IconGrid, IconRadar, IconUsers, IconLogout } from '@/components/ui/icons'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/canales', label: 'Canales', Icon: IconGrid },
  { href: '/descubrimiento', label: 'Descubrimiento', Icon: IconRadar },
  { href: '/equipo', label: 'Equipo', Icon: IconUsers },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed left-4 top-4 bottom-4 z-10 flex w-16 flex-col items-center justify-between rounded-[32px] bg-sidebar py-5"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent-lime text-accent-lime-ink font-bold">
          FC
        </div>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
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
  )
}
