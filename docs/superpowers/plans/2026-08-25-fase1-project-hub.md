# Project Hub (Auth, Roles, Perfil de Canal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el esqueleto de la plataforma — login de equipo con roles, y CRUD del perfil/ADN de canal — para que el Discovery Engine (plan siguiente) tenga dónde autenticar usuarios y a qué `channel` atar sus resultados.

**Architecture:** Next.js (App Router) + TypeScript sobre Supabase (Postgres + Auth + RLS), usando `@supabase/ssr` para sesiones server-side. Autorización basada en una tabla `team_members` con un enum de roles, verificado en RLS vía una función `security definer` en un schema privado (no en un schema expuesto — evita el patrón inseguro de usar `user_metadata`/JWT claims editables por el usuario para decisiones de autorización).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (CLI local + Postgres + Auth), `@supabase/ssr`, `@supabase/supabase-js` v2, Vitest, Zod, React Hook Form, Node.js 22+.

**Spec:** `docs/superpowers/specs/2026-08-25-fabrica-canales-youtube-design.md`

## Global Constraints

- Node.js 22+ requerido (Supabase JS libs dejaron de soportar Node 20 el 2026-06-30).
- RLS habilitado en toda tabla del schema `public` (schema expuesto por defecto) — sin excepciones.
- Desde el 2026-04-28, las tablas nuevas de `public` **no** se exponen automáticamente a la Data API — cada tabla necesita `GRANT` explícito a `authenticated` además de sus políticas RLS.
- Nunca usar `raw_user_meta_data` / `user_metadata` en decisiones de autorización (es editable por el usuario). La autorización por rol vive en la tabla `team_members`, no en el JWT.
- Ninguna función `security definer` va en un schema expuesto (`public`); van en un schema privado (`private`).
- Roles del sistema (spec sección 1): `admin`, `investigador`, `guionista`, `editor`, `aprobador`. En esta fase solo `admin` e `investigador` tienen permisos de escritura activos (canales); los demás roles existen ya en el enum para que los módulos futuros (Script/Voice/Visual Factory) no requieran una migración de esquema para agregarlos.
- Sin auto-registro: la creación de cuentas de equipo es responsabilidad de un `admin` (vía script de seed en esta fase — una UI de invitación queda fuera de alcance de Fase 1, ver Task 3).
- El campo `thumbnail_template` (jsonb) ya existe en `channels` desde esta fase (default `{}`), pero su edición vía UI queda diferida al módulo Thumbnail Factory (roadmap, spec sección 11) — construir un editor visual de plantilla ahora sería trabajo desechable.

---

## Mapa de archivos

```
package.json, tsconfig.json, next.config.ts       # scaffold Next.js
.env.local (no versionado), .env.example
supabase/config.toml
supabase/migrations/*.sql
lib/supabase/client.ts                             # cliente browser
lib/supabase/server.ts                             # cliente server (SSR)
proxy.ts                                       # refresco de sesión
scripts/seed-team-member.ts                         # crear cuentas de equipo (admin-only, CLI)
app/login/page.tsx
app/(protected)/layout.tsx                          # guard de auth
app/(protected)/equipo/page.tsx                     # lista/edición de roles (admin)
app/(protected)/canales/page.tsx                    # lista de canales
app/(protected)/canales/nuevo/page.tsx               # crear canal
app/(protected)/canales/[id]/page.tsx                 # editar canal
lib/channels/schema.ts                              # validación Zod del perfil/ADN
types/database.ts                                    # tipos generados por Supabase CLI
tests/helpers/supabase-test-client.ts                 # helpers de test (usuarios con cada rol)
tests/rls/team-members.test.ts
tests/rls/channels.test.ts
tests/channels/schema.test.ts
```

---

### Task 1: Scaffold del proyecto Next.js + Supabase local

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `supabase/config.toml`

**Interfaces:**
- Produces: proyecto Next.js corriendo en `localhost:3000`, stack local de Supabase corriendo (Postgres en `localhost:54322`, Studio en `localhost:54323`), variables de entorno documentadas en `.env.example`.

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest . --typescript --app --eslint --tailwind --import-alias "@/*" --no-src-dir
```

- [ ] **Step 2: Verificar que el dev server levanta**

Run: `npm run dev` (verificar en `http://localhost:3000`, luego `Ctrl+C`)
Expected: página default de Next.js carga sin errores en consola.

- [ ] **Step 3: Instalar dependencias de Supabase, validación y testing**

```bash
npm install @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom dotenv
```

- [ ] **Step 4: Inicializar Supabase local (requiere Docker corriendo)**

```bash
npx supabase init
npx supabase start
```

Expected: la salida imprime `API URL`, `anon key` y `service_role key` locales — cópialas para el paso siguiente.

- [ ] **Step 5: Configurar variables de entorno**

Crear `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Copiar a `.env.local` (no versionado) con los valores impresos por `supabase start`.

- [ ] **Step 6: Configurar Vitest**

Crear `vitest.config.ts`:

```typescript
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

Nota: Next.js resuelve el alias `@/*` solo (vía `tsconfig.json`), pero Vitest corre sobre Vite directamente y no lee `tsconfig.json` paths sin configuración explícita — de ahí el bloque `resolve.alias` de arriba, sin el cual cualquier test que importe con `@/...` falla con "Failed to resolve import" aunque el archivo exista.

Crear `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })
```

Agregar a `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Supabase local stack and Vitest"
```

---

### Task 2: Schema de roles y `team_members` con RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_team_members.sql`
- Test: `tests/rls/team-members.test.ts`
- Create: `tests/helpers/supabase-test-client.ts`

**Interfaces:**
- Produces: tabla `public.team_members(id uuid, email text, role public.team_role, created_at)`, función `private.get_my_role()`. El tipo TS del enum se obtiene generado (`Database['public']['Enums']['team_role']`) en el Task 5, Step 7 — no se escribe a mano.
- Consumes: ninguno (primera tabla del sistema).

- [ ] **Step 1: Crear el archivo de migración**

```bash
npx supabase migration new team_members
```

- [ ] **Step 2: Escribir el helper de tests (antes de que exista la tabla, para que el test falle correctamente)**

`tests/helpers/supabase-test-client.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createTestUser(role: string, emailPrefix: string) {
  const admin = serviceClient()
  const email = `${emailPrefix}-${Date.now()}@test.local`
  const password = 'test-password-123!'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`No se pudo crear usuario de prueba: ${error?.message}`)

  const { error: insertError } = await admin
    .from('team_members')
    .insert({ id: data.user.id, email, role })
  if (insertError) throw new Error(`No se pudo insertar team_member: ${insertError.message}`)

  const scopedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error: signInError } = await scopedClient.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`No se pudo iniciar sesión de prueba: ${signInError.message}`)

  return { client: scopedClient, userId: data.user.id, email }
}

export async function deleteTestUser(userId: string) {
  const admin = serviceClient()
  await admin.auth.admin.deleteUser(userId)
}
```

- [ ] **Step 3: Escribir el test que falla (la tabla todavía no existe)**

`tests/rls/team-members.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: team_members', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  it('cualquier usuario autenticado puede leer todos los team_members', async () => {
    const admin = await createTestUser('admin', 'admin')
    createdUserIds.push(admin.userId)
    const viewer = await createTestUser('guionista', 'viewer')
    createdUserIds.push(viewer.userId)

    const { data, error } = await viewer.client.from('team_members').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(2)
  })

  it('un rol no-admin no puede cambiar el rol de otro miembro', async () => {
    const admin = await createTestUser('admin', 'admin2')
    createdUserIds.push(admin.userId)
    const nonAdmin = await createTestUser('guionista', 'nonadmin')
    createdUserIds.push(nonAdmin.userId)

    const { error } = await nonAdmin.client
      .from('team_members')
      .update({ role: 'admin' })
      .eq('id', admin.userId)

    expect(error).not.toBeNull()
  })

  it('un admin sí puede cambiar el rol de otro miembro', async () => {
    const admin = await createTestUser('admin', 'admin3')
    createdUserIds.push(admin.userId)
    const target = await createTestUser('guionista', 'target')
    createdUserIds.push(target.userId)

    const { error } = await admin.client
      .from('team_members')
      .update({ role: 'editor' })
      .eq('id', target.userId)

    expect(error).toBeNull()
  })
})
```

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `npm test -- tests/rls/team-members.test.ts`
Expected: FAIL — `relation "public.team_members" does not exist` (o el insert del helper falla).

- [ ] **Step 5: Escribir la migración**

En el archivo creado en el Step 1:

```sql
create schema if not exists private;

create type public.team_role as enum ('admin', 'investigador', 'guionista', 'editor', 'aprobador');

create table public.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.team_role not null default 'investigador',
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;

create or replace function private.get_my_role()
returns public.team_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.team_members where id = auth.uid();
$$;

create policy "team_members_select_all_authenticated"
  on public.team_members for select
  to authenticated
  using (true);

create policy "team_members_admin_insert"
  on public.team_members for insert
  to authenticated
  with check (private.get_my_role() = 'admin');

create policy "team_members_admin_update"
  on public.team_members for update
  to authenticated
  using (private.get_my_role() = 'admin')
  with check (private.get_my_role() = 'admin');

create policy "team_members_admin_delete"
  on public.team_members for delete
  to authenticated
  using (private.get_my_role() = 'admin');
```

- [ ] **Step 6: Aplicar la migración localmente**

Run: `npx supabase db reset` (aplica todas las migraciones desde cero al Postgres local)
Expected: termina sin errores, muestra "Applying migration ...team_members.sql".

- [ ] **Step 7: Correr el test y confirmar que pasa**

Run: `npm test -- tests/rls/team-members.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Correr advisors de seguridad**

Run: `npx supabase db advisors` (si la versión del CLI es &lt;2.81.3, omitir este paso y anotarlo en el commit)
Expected: sin advertencias críticas sobre `team_members` (RLS habilitado, función `security definer` fuera de schema expuesto).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations tests/rls/team-members.test.ts tests/helpers/supabase-test-client.ts
git commit -m "feat: add team_members table with role-based RLS"
```

---

### Task 3: Autenticación (SSR) y script de seed de equipo

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `proxy.ts`
- Create: `app/login/page.tsx`
- Create: `app/(protected)/layout.tsx`
- Create: `scripts/seed-team-member.ts`
- Test: `tests/channels/schema.test.ts` (no aplica aquí — ver Task 5; este task no tiene lógica pura testeable con Vitest, se verifica manualmente, ver Step 6)

**Interfaces:**
- Consumes: `public.team_members` (Task 2).
- Produces: `createClient()` (browser, en `lib/supabase/client.ts`), `createClient()` (server async, en `lib/supabase/server.ts`), layout protegido que redirige a `/login` si no hay sesión.

- [ ] **Step 1: Cliente Supabase para browser**

`lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Cliente Supabase para server components**

`lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // se llama desde un Server Component; el middleware refresca la sesión
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Proxy de refresco de sesión**

Nota: en Next.js 16 la convención `middleware.ts` está deprecada a favor de `proxy.ts` (misma función, nombre exportado distinto) — usar `proxy.ts` directamente evita una advertencia de build.

`proxy.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Página de login (email + password, sin auto-registro)**

`app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    router.push('/canales')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Iniciar sesión</h1>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Entrar</button>
    </form>
  )
}
```

- [ ] **Step 5: Layout protegido**

`app/(protected)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
```

- [ ] **Step 6: Script de seed para crear cuentas de equipo**

`scripts/seed-team-member.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const [, , email, password, role] = process.argv

if (!email || !password || !role) {
  console.error('Uso: npx tsx scripts/seed-team-member.ts <email> <password> <rol>')
  console.error('Roles válidos: admin, investigador, guionista, editor, aprobador')
  process.exit(1)
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Error creando usuario: ${error?.message}`)

  const { error: insertError } = await admin
    .from('team_members')
    .insert({ id: data.user.id, email, role })
  if (insertError) throw new Error(`Error insertando team_member: ${insertError.message}`)

  console.log(`Usuario creado: ${email} (rol: ${role})`)
}

main()
```

- [ ] **Step 7: Verificación manual**

```bash
npm install -D tsx
npx tsx scripts/seed-team-member.ts admin@tuequipo.com "contraseña-segura-123" admin
npm run dev
```

Ir a `http://localhost:3000/login`, iniciar sesión con esas credenciales.
Expected: redirige a `/canales` sin error (aunque la página `/canales` todavía no existe hasta Task 5 — es esperado un 404 momentáneo; confirmar solo que el login no lanza error y sí hay redirect).

- [ ] **Step 8: Commit**

```bash
git add lib/supabase proxy.ts app/login app/\(protected\) scripts/seed-team-member.ts package.json
git commit -m "feat: add SSR auth (login, protected layout, session middleware) and team seed script"
```

---

### Task 4: Página de equipo (lista y cambio de rol, solo admin)

**Files:**
- Create: `app/(protected)/equipo/page.tsx`
- Create: `app/(protected)/equipo/actions.ts`

**Interfaces:**
- Consumes: `createClient()` de `lib/supabase/server.ts` (Task 3), tabla `team_members` (Task 2).
- Produces: `updateTeamMemberRole(memberId: string, role: TeamRole): Promise<{ error: string | null }>`.

- [ ] **Step 1: Server action para cambiar rol**

`app/(protected)/equipo/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTeamMemberRole(memberId: string, role: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('team_members').update({ role }).eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/equipo')
  return { error: null }
}
```

- [ ] **Step 2: Página de equipo**

`app/(protected)/equipo/page.tsx`:

```typescript
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
```

Nota: si un miembro sin rol `admin` visita esta página, el `update` fallará silenciosamente por RLS (0 filas afectadas) — es el comportamiento esperado de RLS sin política SELECT adicional para la UPDATE; se deja así para Fase 1 y se refina con un mensaje de error explícito si el equipo lo pide como mejora posterior.

- [ ] **Step 3: Verificación manual**

```bash
npm run dev
```

Iniciar sesión como el `admin` creado en Task 3, ir a `/equipo`, confirmar que la tabla muestra al menos ese usuario.

- [ ] **Step 4: Commit**

```bash
git add app/\(protected\)/equipo
git commit -m "feat: add team page for admins to view members and change roles"
```

---

### Task 5: Schema de `channels` (perfil/ADN) con RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_channels.sql`
- Test: `tests/rls/channels.test.ts`

**Interfaces:**
- Consumes: `private.get_my_role()` (Task 2), `public.team_members` (Task 2).
- Produces: tabla `public.channels(id, name, niche, target_language, target_country, brand_voice_id, visual_style_reference, thumbnail_template jsonb, variation_rules, created_by, created_at, updated_at)`.

- [ ] **Step 1: Crear el archivo de migración**

```bash
npx supabase migration new channels
```

- [ ] **Step 2: Escribir el test que falla**

`tests/rls/channels.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: channels', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  const baseChannel = {
    name: 'Canal de prueba',
    niche: 'finanzas personales',
    target_language: 'es',
    variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
  }

  it('un investigador puede crear un canal', async () => {
    const user = await createTestUser('investigador', 'investigador')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('channels')
      .insert({ ...baseChannel, created_by: user.userId })

    expect(error).toBeNull()
  })

  it('un guionista no puede crear un canal', async () => {
    const user = await createTestUser('guionista', 'guionista')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('channels')
      .insert({ ...baseChannel, created_by: user.userId })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer los canales', async () => {
    const investigador = await createTestUser('investigador', 'investigador2')
    createdUserIds.push(investigador.userId)
    await investigador.client.from('channels').insert({ ...baseChannel, created_by: investigador.userId })

    const guionista = await createTestUser('guionista', 'guionista2')
    createdUserIds.push(guionista.userId)

    const { data, error } = await guionista.client.from('channels').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- tests/rls/channels.test.ts`
Expected: FAIL — `relation "public.channels" does not exist`.

- [ ] **Step 4: Escribir la migración**

```sql
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text not null,
  target_language text not null default 'es',
  target_country text,
  brand_voice_id text,
  visual_style_reference text,
  thumbnail_template jsonb not null default '{}'::jsonb,
  variation_rules text not null,
  created_by uuid not null references public.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.channels enable row level security;

grant select, insert, update, delete on public.channels to authenticated;

create policy "channels_select_all_authenticated"
  on public.channels for select
  to authenticated
  using (true);

create policy "channels_insert_admin_investigador"
  on public.channels for insert
  to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "channels_update_admin_investigador"
  on public.channels for update
  to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "channels_delete_admin"
  on public.channels for delete
  to authenticated
  using (private.get_my_role() = 'admin');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger channels_set_updated_at
  before update on public.channels
  for each row
  execute function public.set_updated_at();
```

- [ ] **Step 5: Aplicar la migración localmente**

Run: `npx supabase db reset`
Expected: aplica ambas migraciones (`team_members`, `channels`) sin errores.

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npm test -- tests/rls/channels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Generar tipos TypeScript desde el schema**

```bash
npx supabase gen types typescript --local > types/database.ts
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations tests/rls/channels.test.ts types/database.ts
git commit -m "feat: add channels table (brand DNA) with role-based RLS"
```

---

### Task 6: Validación Zod del perfil de canal

**Files:**
- Create: `lib/channels/schema.ts`
- Test: `tests/channels/schema.test.ts`

**Interfaces:**
- Produces: `channelSchema: ZodSchema`, `type ChannelInput = z.infer<typeof channelSchema>`.
- Consumes: ninguno.

- [ ] **Step 1: Escribir el test que falla**

`tests/channels/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { channelSchema } from '@/lib/channels/schema'

describe('channelSchema', () => {
  const validInput = {
    name: 'Finanzas Fáciles',
    niche: 'finanzas personales',
    target_language: 'es',
    variation_rules: 'Variar el ángulo del hook y los ejemplos citados en cada video.',
  }

  it('acepta un input válido', () => {
    const result = channelSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rechaza un nombre vacío', () => {
    const result = channelSchema.safeParse({ ...validInput, name: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza reglas de variación demasiado cortas para ser accionables', () => {
    const result = channelSchema.safeParse({ ...validInput, variation_rules: 'variar' })
    expect(result.success).toBe(false)
  })

  it('rechaza un idioma que no sea un código de 2 letras', () => {
    const result = channelSchema.safeParse({ ...validInput, target_language: 'español' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- tests/channels/schema.test.ts`
Expected: FAIL — no se puede importar `@/lib/channels/schema` (el archivo no existe).

- [ ] **Step 3: Implementar el schema**

`lib/channels/schema.ts`:

```typescript
import { z } from 'zod'

export const channelSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  niche: z.string().min(1, 'El nicho es obligatorio'),
  target_language: z.string().length(2, 'Usa un código de idioma de 2 letras (ej. "es")'),
  target_country: z.string().optional(),
  brand_voice_id: z.string().optional(),
  visual_style_reference: z.string().optional(),
  variation_rules: z
    .string()
    .min(20, 'Describe reglas de variación concretas (mínimo 20 caracteres) — esto controla el riesgo de "Inauthentic Content"'),
})

export type ChannelInput = z.infer<typeof channelSchema>
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- tests/channels/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/channels/schema.ts tests/channels/schema.test.ts
git commit -m "feat: add Zod validation schema for channel brand-DNA profile"
```

---

### Task 7: UI de canales (lista, crear, editar)

**Files:**
- Create: `app/(protected)/canales/page.tsx`
- Create: `app/(protected)/canales/nuevo/page.tsx`
- Create: `app/(protected)/canales/[id]/page.tsx`
- Create: `app/(protected)/canales/actions.ts`

**Interfaces:**
- Consumes: `channelSchema` (Task 6), `createClient()` server (Task 3), tabla `channels` (Task 5).
- Produces: `createChannel(input: ChannelInput): Promise<{ error: string | null }>`, `updateChannel(id: string, input: ChannelInput): Promise<{ error: string | null }>`.

- [ ] **Step 1: Server actions de canal**

`app/(protected)/canales/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { channelSchema, type ChannelInput } from '@/lib/channels/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createChannel(input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('channels').insert({ ...parsed.data, created_by: user.id })
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}

export async function updateChannel(id: string, input: ChannelInput) {
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('channels').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/canales')
  redirect('/canales')
}
```

- [ ] **Step 2: Lista de canales**

`app/(protected)/canales/page.tsx`:

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CanalesPage() {
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, niche, target_language')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1>Canales</h1>
      <Link href="/canales/nuevo">+ Nuevo canal</Link>
      <ul>
        {channels?.map((c) => (
          <li key={c.id}>
            <Link href={`/canales/${c.id}`}>{c.name}</Link> — {c.niche} ({c.target_language})
          </li>
        ))}
      </ul>
      {channels?.length === 0 && <p>Todavía no hay canales. Crea el primero.</p>}
    </div>
  )
}
```

- [ ] **Step 3: Formulario de creación**

`app/(protected)/canales/nuevo/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createChannel } from '../actions'

export default function NuevoCanalPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await createChannel({
      name: formData.get('name') as string,
      niche: formData.get('niche') as string,
      target_language: formData.get('target_language') as string,
      target_country: (formData.get('target_country') as string) || undefined,
      brand_voice_id: (formData.get('brand_voice_id') as string) || undefined,
      visual_style_reference: (formData.get('visual_style_reference') as string) || undefined,
      variation_rules: formData.get('variation_rules') as string,
    })
    if (result?.error) setError(result.error)
  }

  return (
    <form action={handleSubmit}>
      <h1>Nuevo canal</h1>
      <input name="name" placeholder="Nombre del canal" required />
      <input name="niche" placeholder="Nicho" required />
      <input name="target_language" placeholder="Idioma (ej. es)" defaultValue="es" required />
      <input name="target_country" placeholder="País (opcional)" />
      <input name="brand_voice_id" placeholder="Voz de marca (opcional)" />
      <textarea name="visual_style_reference" placeholder="Referencia de estilo visual (opcional)" />
      <textarea name="variation_rules" placeholder="Reglas de variación obligatoria" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Crear canal</button>
    </form>
  )
}
```

- [ ] **Step 4: Formulario de edición**

`app/(protected)/canales/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateChannel } from '../actions'

export default async function EditarCanalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: channel } = await supabase.from('channels').select('*').eq('id', id).single()

  if (!channel) notFound()

  async function handleSubmit(formData: FormData) {
    'use server'
    await updateChannel(id, {
      name: formData.get('name') as string,
      niche: formData.get('niche') as string,
      target_language: formData.get('target_language') as string,
      target_country: (formData.get('target_country') as string) || undefined,
      brand_voice_id: (formData.get('brand_voice_id') as string) || undefined,
      visual_style_reference: (formData.get('visual_style_reference') as string) || undefined,
      variation_rules: formData.get('variation_rules') as string,
    })
  }

  return (
    <form action={handleSubmit}>
      <h1>Editar canal</h1>
      <input name="name" defaultValue={channel.name} required />
      <input name="niche" defaultValue={channel.niche} required />
      <input name="target_language" defaultValue={channel.target_language} required />
      <input name="target_country" defaultValue={channel.target_country ?? ''} />
      <input name="brand_voice_id" defaultValue={channel.brand_voice_id ?? ''} />
      <textarea name="visual_style_reference" defaultValue={channel.visual_style_reference ?? ''} />
      <textarea name="variation_rules" defaultValue={channel.variation_rules} required />
      <button type="submit">Guardar cambios</button>
    </form>
  )
}
```

- [ ] **Step 5: Verificación manual end-to-end**

```bash
npm run dev
```

Iniciar sesión, ir a `/canales/nuevo`, crear un canal con reglas de variación de al menos 20 caracteres, confirmar que redirige a `/canales` y el canal aparece listado. Editarlo desde `/canales/[id]` y confirmar que el cambio persiste.

- [ ] **Step 6: Commit**

```bash
git add app/\(protected\)/canales
git commit -m "feat: add channel list, create, and edit pages"
```

---

### Task 8: Verificación final de la Fase 1 (Hub)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests pasan (RLS de `team_members`, RLS de `channels`, schema de `channels`).

- [ ] **Step 2: Correr el linter y el build de producción**

```bash
npm run lint
npm run build
```

Expected: sin errores.

- [ ] **Step 3: Smoke test manual completo**

Con `npm run dev` corriendo: login como `admin` → ver `/equipo` → crear un segundo usuario con `scripts/seed-team-member.ts` como `investigador` → confirmar que ese usuario puede crear un canal pero no cambiar roles en `/equipo` (la actualización no debe reflejarse, por RLS).

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: final verification pass for Project Hub (Phase 1)"
```
