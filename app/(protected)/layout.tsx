import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <main className="min-h-screen pl-28 pr-6 py-8 md:pl-32 md:pr-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
