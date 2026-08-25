import { createClient } from '@/lib/supabase/server'
import { updateTeamMemberRole } from './actions'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const ROLES = ['admin', 'investigador', 'guionista', 'editor', 'aprobador'] as const

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: members } = await supabase.from('team_members').select('id, email, role').order('email')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Equipo</h1>
      <Card>
        <div className="divide-y divide-border">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-medium text-ink">{m.email}</span>
              <form action={updateTeamMemberRole.bind(null, m.id) as never} className="flex items-center gap-2">
                <Select name="role" defaultValue={m.role} className="w-auto">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary">Guardar</Button>
              </form>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
