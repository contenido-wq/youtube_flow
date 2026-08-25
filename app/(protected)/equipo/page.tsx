import { createClient } from '@/lib/supabase/server'
import { updateTeamMemberRole } from './actions'

const ROLES = ['admin', 'investigador', 'guionista', 'editor', 'aprobador'] as const

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: members } = await supabase.from('team_members').select('id, email, role').order('email')

  return (
    <div>
      <h1>Equipo</h1>
      <table>
        <tbody>
          {members?.map((m) => (
            <tr key={m.id}>
              <td>{m.email}</td>
              <td>
                <form action={updateTeamMemberRole.bind(null, m.id) as never}>
                  <select name="role" defaultValue={m.role}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="submit">Guardar</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
