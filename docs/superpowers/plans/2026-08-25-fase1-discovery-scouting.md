# Discovery Engine — Scouting Parametrizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el equipo pueda correr una búsqueda parametrizada (edad de canal, suscriptores, vistas, nicho) y ver una lista de canales candidatos con un puntaje compuesto de "qué tan cerca está de monetizar con espacio para crecer", guardada para revisarla después.

**Architecture:** Un motor de descubrimiento detrás de una interfaz `DiscoveryEngine` (adaptador intercambiable, spec sección 5.2) — este plan implementa **un solo motor concreto: YouTube Data API v3** (gratis, oficial, sin infraestructura propia que levantar), porque es el camino de menor fricción para tener algo funcionando y testeable de punta a punta. Los motores self-hosted (Piped/NewPipe) y Apify quedan como un plan de seguimiento que implementa la misma interfaz — no bloquean esta entrega.

**Tech Stack:** Next.js (Server Actions) + TypeScript, Supabase (Postgres/RLS), `fetch` nativo contra `googleapis.com/youtube/v3`, Vitest con `fetch` mockeado (sin llamadas de red reales en tests).

**Spec:** `docs/superpowers/specs/2026-08-25-fabrica-canales-youtube-design.md` (sección 5.1, 5.2)

## Global Constraints

- Requiere que el plan `2026-08-25-fase1-project-hub.md` esté implementado primero (usa `team_members`, RLS de roles, `createClient()` server).
- El motor YouTube Data API v3 es free-tier con cuota diaria (10,000 unidades) — `search.list` cuesta 100 unidades/llamada, `channels.list`/`playlistItems.list`/`videos.list` cuestan 1 unidad/llamada. El código debe minimizar llamadas a `search.list` y preferir hidratar con las llamadas baratas.
- Extracción de catálogo de un canal usa el *uploads playlist trick* (`channels.list` → `contentDetails.relatedPlaylists.uploads` → `playlistItems.list`), nunca `search.list` para esto.
- El puntaje de monetización es una función pura, documentada, con pesos ajustables como constantes — no un valor mágico sin explicación.
- Solo roles `admin` e `investigador` pueden disparar una búsqueda (misma regla que crear canales, spec sección 1 y Fase 0).
- Los motores self-hosted (Piped/NewPipe Extractor) y Apify quedan fuera de esta entrega — se anota explícitamente aquí para que no se lean como un olvido: implementan la misma interfaz `DiscoveryEngine` en un plan posterior.

---

## Mapa de archivos

```
supabase/migrations/<timestamp>_discovery.sql
lib/discovery/types.ts                        # DiscoveryEngine, DiscoveredChannel, ChannelSearchFilters
lib/discovery/scoring.ts                       # calculateMonetizationScore (función pura)
lib/discovery/scoring.test.ts
lib/discovery/duration.ts                      # parseISO8601Duration (helper para detectar Shorts)
lib/discovery/duration.test.ts
lib/discovery/youtube-api-engine.ts             # implementación concreta de DiscoveryEngine
lib/discovery/youtube-api-engine.test.ts
app/(protected)/descubrimiento/page.tsx
app/(protected)/descubrimiento/actions.ts
app/(protected)/descubrimiento/[runId]/page.tsx
.env.example                                    # + YOUTUBE_API_KEY
```

---

### Task 1: Schema de `discovery_runs` y `discovery_results` con RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_discovery.sql`
- Test: `tests/rls/discovery.test.ts`

**Interfaces:**
- Consumes: `private.get_my_role()`, `public.team_members` (del plan de Project Hub).
- Produces: tablas `public.discovery_runs`, `public.discovery_results`.

- [ ] **Step 1: Crear el archivo de migración**

```bash
npx supabase migration new discovery
```

- [ ] **Step 2: Escribir el test que falla**

`tests/rls/discovery.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: discovery_runs / discovery_results', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  it('un investigador puede crear un discovery_run y sus resultados', async () => {
    const user = await createTestUser('investigador', 'inv-disc')
    createdUserIds.push(user.userId)

    const { data: run, error: runError } = await user.client
      .from('discovery_runs')
      .insert({ created_by: user.userId, filters: { maxAgeDays: 90, maxSubscribers: 100000, minAvgViews: 1000 }, status: 'completed' })
      .select()
      .single()

    expect(runError).toBeNull()

    const { error: resultError } = await user.client.from('discovery_results').insert({
      discovery_run_id: run!.id,
      youtube_channel_id: 'UC_test123',
      channel_title: 'Canal de prueba',
      channel_published_at: new Date().toISOString(),
      subscriber_count: 500,
      recent_video_count: 10,
      avg_recent_views: 5000,
      shorts_ratio: 0.8,
      upload_velocity_per_week: 4,
      monetization_score: 72.5,
    })

    expect(resultError).toBeNull()
  })

  it('un guionista no puede crear un discovery_run', async () => {
    const user = await createTestUser('guionista', 'guion-disc')
    createdUserIds.push(user.userId)

    const { error } = await user.client
      .from('discovery_runs')
      .insert({ created_by: user.userId, filters: {}, status: 'pending' })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer discovery_runs y discovery_results', async () => {
    const investigador = await createTestUser('investigador', 'inv-disc2')
    createdUserIds.push(investigador.userId)
    await investigador.client
      .from('discovery_runs')
      .insert({ created_by: investigador.userId, filters: {}, status: 'completed' })

    const guionista = await createTestUser('guionista', 'guion-disc2')
    createdUserIds.push(guionista.userId)

    const { data, error } = await guionista.client.from('discovery_runs').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- tests/rls/discovery.test.ts`
Expected: FAIL — `relation "public.discovery_runs" does not exist`.

- [ ] **Step 4: Escribir la migración**

```sql
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.team_members(id),
  filters jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.discovery_results (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.discovery_runs(id) on delete cascade,
  youtube_channel_id text not null,
  channel_title text not null,
  channel_published_at timestamptz not null,
  subscriber_count bigint,
  recent_video_count int not null,
  avg_recent_views numeric not null,
  shorts_ratio numeric not null,
  upload_velocity_per_week numeric not null,
  monetization_score numeric not null,
  created_at timestamptz not null default now()
);

alter table public.discovery_runs enable row level security;
alter table public.discovery_results enable row level security;

grant select, insert, update, delete on public.discovery_runs to authenticated;
grant select, insert, update, delete on public.discovery_results to authenticated;

create policy "discovery_runs_select_all_authenticated"
  on public.discovery_runs for select to authenticated using (true);

create policy "discovery_runs_insert_admin_investigador"
  on public.discovery_runs for insert to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "discovery_runs_update_admin_investigador"
  on public.discovery_runs for update to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "discovery_results_select_all_authenticated"
  on public.discovery_results for select to authenticated using (true);

create policy "discovery_results_insert_admin_investigador"
  on public.discovery_results for insert to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));
```

- [ ] **Step 5: Aplicar la migración localmente**

Run: `npx supabase db reset`
Expected: aplica todas las migraciones sin errores.

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npm test -- tests/rls/discovery.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Regenerar tipos**

```bash
npx supabase gen types typescript --local > types/database.ts
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations tests/rls/discovery.test.ts types/database.ts
git commit -m "feat: add discovery_runs and discovery_results tables with RLS"
```

---

### Task 2: Función de puntaje de monetización (pura, testeada)

**Files:**
- Create: `lib/discovery/scoring.ts`
- Test: `lib/discovery/scoring.test.ts`

**Interfaces:**
- Produces: `calculateMonetizationScore(input: ScoringInput): number` (0-100), `type ScoringInput`.
- Consumes: ninguno.

- [ ] **Step 1: Escribir el test que falla**

`lib/discovery/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateMonetizationScore } from './scoring'

const baseFilters = { maxAgeDays: 90, maxSubscribers: 100000, minAvgViews: 1000 }

describe('calculateMonetizationScore', () => {
  it('un canal nuevo, con alta velocidad y muchas vistas, pero pocos subs, saca puntaje alto', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 20,
      uploadVelocityPerWeek: 5,
      avgRecentViews: 5000,
      subscriberCount: 2000,
      filters: baseFilters,
    })
    expect(score).toBeGreaterThan(70)
  })

  it('un canal casi al límite de edad y de subs, con pocas vistas, saca puntaje bajo', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 88,
      uploadVelocityPerWeek: 0.5,
      avgRecentViews: 1050,
      subscriberCount: 95000,
      filters: baseFilters,
    })
    expect(score).toBeLessThan(30)
  })

  it('el puntaje siempre está entre 0 y 100', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 0,
      uploadVelocityPerWeek: 50,
      avgRecentViews: 1_000_000,
      subscriberCount: 0,
      filters: baseFilters,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('subscriberCount null (canal con contador oculto) no rompe el cálculo', () => {
    const score = calculateMonetizationScore({
      channelAgeDays: 30,
      uploadVelocityPerWeek: 3,
      avgRecentViews: 3000,
      subscriberCount: null,
      filters: baseFilters,
    })
    expect(Number.isFinite(score)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/scoring.test.ts`
Expected: FAIL — no se puede importar `./scoring`.

- [ ] **Step 3: Implementar la función**

`lib/discovery/scoring.ts`:

```typescript
export interface ScoringFilters {
  maxAgeDays: number
  maxSubscribers: number
  minAvgViews: number
}

export interface ScoringInput {
  channelAgeDays: number
  uploadVelocityPerWeek: number
  avgRecentViews: number
  subscriberCount: number | null
  filters: ScoringFilters
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Pesos del puntaje compuesto (spec 5.1: los suscriptores solos son una señal
// débil de monetización real desde el ajuste de umbrales de YouTube de agosto
// 2026 — se pondera más la trayectoria (velocidad + desempeño de vistas) que
// el tamaño de audiencia actual).
const WEIGHT_AGE_FIT = 30
const WEIGHT_VIEWS_FIT = 30
const WEIGHT_UPLOAD_VELOCITY = 25
const WEIGHT_SUBSCRIBER_HEADROOM = 15

// Cadencia de subida considerada "de fábrica" — a partir de esto se otorga
// el puntaje completo de velocidad. Ajustable si el equipo calibra otro valor.
const FACTORY_VELOCITY_PER_WEEK = 3

export function calculateMonetizationScore(input: ScoringInput): number {
  const { channelAgeDays, uploadVelocityPerWeek, avgRecentViews, subscriberCount, filters } = input

  const ageFit = WEIGHT_AGE_FIT * clamp(1 - channelAgeDays / filters.maxAgeDays, 0, 1)

  const viewsFit =
    WEIGHT_VIEWS_FIT *
    clamp((avgRecentViews - filters.minAvgViews) / filters.minAvgViews, 0, 1)

  const velocityFit =
    WEIGHT_UPLOAD_VELOCITY * clamp(uploadVelocityPerWeek / FACTORY_VELOCITY_PER_WEEK, 0, 1)

  const subscriberHeadroom =
    WEIGHT_SUBSCRIBER_HEADROOM *
    clamp(1 - (subscriberCount ?? 0) / filters.maxSubscribers, 0, 1)

  const total = ageFit + viewsFit + velocityFit + subscriberHeadroom

  return Math.round(clamp(total, 0, 100) * 10) / 10
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/scoring.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/scoring.ts lib/discovery/scoring.test.ts
git commit -m "feat: add composite monetization scoring function"
```

---

### Task 3: Parser de duración ISO 8601 (para detectar Shorts)

**Files:**
- Create: `lib/discovery/duration.ts`
- Test: `lib/discovery/duration.test.ts`

**Interfaces:**
- Produces: `parseISO8601Duration(duration: string): number` (segundos), `isShort(durationSeconds: number): boolean`.

- [ ] **Step 1: Escribir el test que falla**

`lib/discovery/duration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseISO8601Duration, isShort } from './duration'

describe('parseISO8601Duration', () => {
  it('parsea segundos solos', () => {
    expect(parseISO8601Duration('PT45S')).toBe(45)
  })

  it('parsea minutos y segundos', () => {
    expect(parseISO8601Duration('PT4M13S')).toBe(253)
  })

  it('parsea horas, minutos y segundos', () => {
    expect(parseISO8601Duration('PT1H2M3S')).toBe(3723)
  })

  it('devuelve 0 para un formato vacío o inválido', () => {
    expect(parseISO8601Duration('')).toBe(0)
    expect(parseISO8601Duration('invalid')).toBe(0)
  })
})

describe('isShort', () => {
  it('un video de 45 segundos es Short', () => {
    expect(isShort(45)).toBe(true)
  })

  it('un video de 180 segundos (3 min) es Short', () => {
    expect(isShort(180)).toBe(true)
  })

  it('un video de 181 segundos no es Short', () => {
    expect(isShort(181)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/duration.test.ts`
Expected: FAIL — no se puede importar `./duration`.

- [ ] **Step 3: Implementar**

`lib/discovery/duration.ts`:

```typescript
const ISO_8601_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/

export function parseISO8601Duration(duration: string): number {
  const match = ISO_8601_DURATION_REGEX.exec(duration)
  if (!match) return 0

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)

  return hours * 3600 + minutes * 60 + seconds
}

// YouTube Shorts: videos de hasta 3 minutos (180s) a la fecha de este spec.
const SHORTS_MAX_SECONDS = 180

export function isShort(durationSeconds: number): boolean {
  return durationSeconds <= SHORTS_MAX_SECONDS
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/duration.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/duration.ts lib/discovery/duration.test.ts
git commit -m "feat: add ISO 8601 duration parser and Shorts detector"
```

---

### Task 4: Motor de descubrimiento — YouTube Data API v3

**Files:**
- Create: `lib/discovery/types.ts`
- Create: `lib/discovery/youtube-api-engine.ts`
- Test: `lib/discovery/youtube-api-engine.test.ts`

**Interfaces:**
- Consumes: `calculateMonetizationScore` (Task 2), `parseISO8601Duration`/`isShort` (Task 3).
- Produces: `interface DiscoveryEngine { searchChannels(filters: ChannelSearchFilters): Promise<DiscoveredChannel[]> }`, `class YouTubeApiDiscoveryEngine implements DiscoveryEngine`.

- [ ] **Step 1: Definir los tipos e interfaz del adaptador**

`lib/discovery/types.ts`:

```typescript
export interface ChannelSearchFilters {
  query: string
  maxAgeDays: number
  maxSubscribers: number
  minAvgViews: number
  maxResults?: number
}

export interface DiscoveredChannel {
  youtubeChannelId: string
  channelTitle: string
  channelPublishedAt: string
  subscriberCount: number | null
  recentVideoCount: number
  avgRecentViews: number
  shortsRatio: number
  uploadVelocityPerWeek: number
  monetizationScore: number
}

export interface DiscoveryEngine {
  searchChannels(filters: ChannelSearchFilters): Promise<DiscoveredChannel[]>
}
```

- [ ] **Step 2: Escribir el test que falla (fetch mockeado, sin red real)**

`lib/discovery/youtube-api-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YouTubeApiDiscoveryEngine } from './youtube-api-engine'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('YouTubeApiDiscoveryEngine', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca canales, los hidrata y calcula el puntaje de monetización', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    // 1. search.list -> un canal candidato
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: { channelId: 'UC_abc' }, snippet: { title: 'Canal Abc', publishedAt: '2026-06-01T00:00:00Z' } }] })
    )
    // 2. channels.list -> stats + uploads playlist
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          {
            id: 'UC_abc',
            statistics: { subscriberCount: '3000' },
            contentDetails: { relatedPlaylists: { uploads: 'UU_abc' } },
          },
        ],
      })
    )
    // 3. playlistItems.list -> ids de videos recientes
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-20T00:00:00Z' } },
          { contentDetails: { videoId: 'v2', videoPublishedAt: '2026-08-10T00:00:00Z' } },
        ],
      })
    )
    // 4. videos.list -> stats + duración de esos videos
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', statistics: { viewCount: '4000' }, contentDetails: { duration: 'PT45S' } },
          { id: 'v2', statistics: { viewCount: '6000' }, contentDetails: { duration: 'PT8M0S' } },
        ],
      })
    )

    const engine = new YouTubeApiDiscoveryEngine('fake-api-key')
    const results = await engine.searchChannels({
      query: 'finanzas personales',
      maxAgeDays: 90,
      maxSubscribers: 100000,
      minAvgViews: 1000,
    })

    expect(results).toHaveLength(1)
    expect(results[0].youtubeChannelId).toBe('UC_abc')
    expect(results[0].subscriberCount).toBe(3000)
    expect(results[0].recentVideoCount).toBe(2)
    expect(results[0].avgRecentViews).toBe(5000)
    expect(results[0].shortsRatio).toBe(0.5)
    expect(results[0].monetizationScore).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('descarta canales sin uploads playlist en vez de lanzar una excepción', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: { channelId: 'UC_empty' }, snippet: { title: 'Vacío', publishedAt: '2026-06-01T00:00:00Z' } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ id: 'UC_empty', statistics: {}, contentDetails: { relatedPlaylists: {} } }] })
    )

    const engine = new YouTubeApiDiscoveryEngine('fake-api-key')
    const results = await engine.searchChannels({
      query: 'finanzas personales',
      maxAgeDays: 90,
      maxSubscribers: 100000,
      minAvgViews: 1000,
    })

    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/youtube-api-engine.test.ts`
Expected: FAIL — no se puede importar `./youtube-api-engine`.

- [ ] **Step 4: Implementar el motor**

`lib/discovery/youtube-api-engine.ts`:

```typescript
import { calculateMonetizationScore } from './scoring'
import { parseISO8601Duration, isShort } from './duration'
import type { ChannelSearchFilters, DiscoveredChannel, DiscoveryEngine } from './types'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export class YouTubeApiDiscoveryEngine implements DiscoveryEngine {
  constructor(private readonly apiKey: string) {}

  async searchChannels(filters: ChannelSearchFilters): Promise<DiscoveredChannel[]> {
    const publishedAfter = new Date(Date.now() - filters.maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

    // search.list: 100 unidades de cuota — se llama una sola vez por búsqueda.
    const candidates = await this.searchCandidateChannels(filters.query, publishedAfter, filters.maxResults ?? 25)
    if (candidates.length === 0) return []

    // channels.list: 1 unidad/llamada — hidrata stats + uploads playlist.
    const hydrated = await this.hydrateChannels(candidates.map((c) => c.channelId))

    const results: DiscoveredChannel[] = []
    for (const candidate of candidates) {
      const info = hydrated.get(candidate.channelId)
      const uploadsPlaylistId = info?.uploadsPlaylistId
      if (!uploadsPlaylistId) continue

      const recentVideoIds = await this.getRecentVideoIds(uploadsPlaylistId)
      if (recentVideoIds.length === 0) continue

      const videoStats = await this.getVideoStats(recentVideoIds.map((v) => v.videoId))

      const views = videoStats.map((v) => v.viewCount)
      const avgRecentViews = views.reduce((a, b) => a + b, 0) / views.length
      const shortsCount = videoStats.filter((v) => isShort(v.durationSeconds)).length
      const shortsRatio = shortsCount / videoStats.length

      const channelAgeDays = (Date.now() - new Date(candidate.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
      const oldestRecent = recentVideoIds[recentVideoIds.length - 1]
      const windowDays = Math.max(
        1,
        (Date.now() - new Date(oldestRecent.videoPublishedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      const uploadVelocityPerWeek = (recentVideoIds.length / windowDays) * 7

      const monetizationScore = calculateMonetizationScore({
        channelAgeDays,
        uploadVelocityPerWeek,
        avgRecentViews,
        subscriberCount: info.subscriberCount,
        filters: {
          maxAgeDays: filters.maxAgeDays,
          maxSubscribers: filters.maxSubscribers,
          minAvgViews: filters.minAvgViews,
        },
      })

      results.push({
        youtubeChannelId: candidate.channelId,
        channelTitle: candidate.title,
        channelPublishedAt: candidate.publishedAt,
        subscriberCount: info.subscriberCount,
        recentVideoCount: videoStats.length,
        avgRecentViews,
        shortsRatio,
        uploadVelocityPerWeek,
        monetizationScore,
      })
    }

    return results
  }

  private async searchCandidateChannels(
    query: string,
    publishedAfter: string,
    maxResults: number
  ): Promise<{ channelId: string; title: string; publishedAt: string }[]> {
    const url = new URL(`${BASE_URL}/search`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'channel')
    url.searchParams.set('q', query)
    url.searchParams.set('publishedAfter', publishedAfter)
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { id: { channelId: string }; snippet: { title: string; publishedAt: string } }) => ({
      channelId: item.id.channelId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
    }))
  }

  private async hydrateChannels(
    channelIds: string[]
  ): Promise<Map<string, { subscriberCount: number | null; uploadsPlaylistId: string | undefined }>> {
    const url = new URL(`${BASE_URL}/channels`)
    url.searchParams.set('part', 'statistics,contentDetails')
    url.searchParams.set('id', channelIds.join(','))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    const map = new Map<string, { subscriberCount: number | null; uploadsPlaylistId: string | undefined }>()
    for (const item of data.items ?? []) {
      map.set(item.id, {
        subscriberCount: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : null,
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
      })
    }
    return map
  }

  private async getRecentVideoIds(
    uploadsPlaylistId: string
  ): Promise<{ videoId: string; videoPublishedAt: string }[]> {
    const url = new URL(`${BASE_URL}/playlistItems`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', uploadsPlaylistId)
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { contentDetails: { videoId: string; videoPublishedAt: string } }) => ({
      videoId: item.contentDetails.videoId,
      videoPublishedAt: item.contentDetails.videoPublishedAt,
    }))
  }

  private async getVideoStats(
    videoIds: string[]
  ): Promise<{ viewCount: number; durationSeconds: number }[]> {
    const url = new URL(`${BASE_URL}/videos`)
    url.searchParams.set('part', 'statistics,contentDetails')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', this.apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    return (data.items ?? []).map((item: { statistics: { viewCount?: string }; contentDetails: { duration: string } }) => ({
      viewCount: Number(item.statistics.viewCount ?? 0),
      durationSeconds: parseISO8601Duration(item.contentDetails.duration),
    }))
  }
}
```

Nota: los tipos de retorno explícitos en los 4 métodos privados (`Promise<...>`) son necesarios — sin ellos, TypeScript infiere `Promise<any>` porque `response.json()` es `any`, y eso rompe `noImplicitAny` en `npm run build` más adelante (parámetros de `.map()`/`.filter()` quedan como `any` implícito) aunque `npm test` pase sin problema.

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/youtube-api-engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Agregar la variable de entorno**

Agregar a `.env.example`:

```bash
YOUTUBE_API_KEY=
```

Obtener una key real en Google Cloud Console (API "YouTube Data API v3" habilitada) y agregarla a `.env.local`.

- [ ] **Step 7: Commit**

```bash
git add lib/discovery/types.ts lib/discovery/youtube-api-engine.ts lib/discovery/youtube-api-engine.test.ts .env.example
git commit -m "feat: add YouTube Data API v3 discovery engine implementation"
```

---

### Task 5: UI de scouting (disparar búsqueda, ver resultados)

**Files:**
- Create: `app/(protected)/descubrimiento/actions.ts`
- Create: `app/(protected)/descubrimiento/page.tsx`
- Create: `app/(protected)/descubrimiento/[runId]/page.tsx`

**Interfaces:**
- Consumes: `YouTubeApiDiscoveryEngine` (Task 4), `createClient()` server (Project Hub Task 3).
- Produces: `runDiscovery(filters: ChannelSearchFilters): Promise<{ runId: string | null; error: string | null }>`.

- [ ] **Step 1: Server action que orquesta la búsqueda y persiste resultados**

`app/(protected)/descubrimiento/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { YouTubeApiDiscoveryEngine } from '@/lib/discovery/youtube-api-engine'
import type { ChannelSearchFilters } from '@/lib/discovery/types'
import { redirect } from 'next/navigation'

export async function runDiscovery(filters: ChannelSearchFilters) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { runId: null, error: 'No autenticado' }

  const { data: run, error: runError } = await supabase
    .from('discovery_runs')
    .insert({ created_by: user.id, filters, status: 'running' })
    .select()
    .single()

  if (runError || !run) return { runId: null, error: runError?.message ?? 'Error creando el run' }

  try {
    const engine = new YouTubeApiDiscoveryEngine(process.env.YOUTUBE_API_KEY!)
    const results = await engine.searchChannels(filters)

    if (results.length > 0) {
      const { error: resultsError } = await supabase.from('discovery_results').insert(
        results.map((r) => ({
          discovery_run_id: run.id,
          youtube_channel_id: r.youtubeChannelId,
          channel_title: r.channelTitle,
          channel_published_at: r.channelPublishedAt,
          subscriber_count: r.subscriberCount,
          recent_video_count: r.recentVideoCount,
          avg_recent_views: r.avgRecentViews,
          shorts_ratio: r.shortsRatio,
          upload_velocity_per_week: r.uploadVelocityPerWeek,
          monetization_score: r.monetizationScore,
        }))
      )
      if (resultsError) throw new Error(resultsError.message)
    }

    await supabase.from('discovery_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', run.id)
  } catch (err) {
    await supabase
      .from('discovery_runs')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', run.id)
    return { runId: run.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/descubrimiento/${run.id}`)
}
```

- [ ] **Step 2: Formulario para disparar una búsqueda**

`app/(protected)/descubrimiento/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { runDiscovery } from './actions'

export default function DescubrimientoPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await runDiscovery({
      query: formData.get('query') as string,
      maxAgeDays: Number(formData.get('maxAgeDays')),
      maxSubscribers: Number(formData.get('maxSubscribers')),
      minAvgViews: Number(formData.get('minAvgViews')),
    })
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  return (
    <form action={handleSubmit}>
      <h1>Nueva búsqueda de scouting</h1>
      <input name="query" placeholder="Nicho o palabra clave (ej. finanzas personales)" required />
      <label>
        Edad máxima del canal (días)
        <input name="maxAgeDays" type="number" defaultValue={90} required />
      </label>
      <label>
        Suscriptores máximos
        <input name="maxSubscribers" type="number" defaultValue={100000} required />
      </label>
      <label>
        Vistas promedio mínimas por video
        <input name="minAvgViews" type="number" defaultValue={1000} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Buscar'}</button>
    </form>
  )
}
```

- [ ] **Step 3: Página de resultados de un run**

`app/(protected)/descubrimiento/[runId]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function ResultadosPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const supabase = await createClient()

  const { data: run } = await supabase.from('discovery_runs').select('*').eq('id', runId).single()
  if (!run) notFound()

  const { data: results } = await supabase
    .from('discovery_results')
    .select('*')
    .eq('discovery_run_id', runId)
    .order('monetization_score', { ascending: false })

  return (
    <div>
      <h1>Resultados — {run.status}</h1>
      {run.error_message && <p role="alert">{run.error_message}</p>}
      <table>
        <thead>
          <tr>
            <th>Canal</th>
            <th>Puntaje</th>
            <th>Suscriptores</th>
            <th>Vistas prom.</th>
            <th>% Shorts</th>
            <th>Videos/semana</th>
          </tr>
        </thead>
        <tbody>
          {results?.map((r) => (
            <tr key={r.id}>
              <td>
                <a href={`https://www.youtube.com/channel/${r.youtube_channel_id}`} target="_blank" rel="noreferrer">
                  {r.channel_title}
                </a>
              </td>
              <td>{r.monetization_score}</td>
              <td>{r.subscriber_count ?? '—'}</td>
              <td>{Math.round(r.avg_recent_views)}</td>
              <td>{Math.round(r.shorts_ratio * 100)}%</td>
              <td>{r.upload_velocity_per_week.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Verificación manual end-to-end**

Con `YOUTUBE_API_KEY` real en `.env.local` y `npm run dev` corriendo: iniciar sesión como `investigador`, ir a `/descubrimiento`, correr una búsqueda con un nicho real, confirmar que redirige a la página de resultados con canales ordenados por puntaje.

- [ ] **Step 5: Commit**

```bash
git add app/\(protected\)/descubrimiento
git commit -m "feat: add discovery scouting form and results page"
```

---

### Task 6: Verificación final del Scouting

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: todos los tests pasan (RLS de discovery, scoring, duration, youtube-api-engine, más los del plan de Project Hub).

- [ ] **Step 2: Lint y build**

```bash
npm run lint
npm run build
```

Expected: sin errores.

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: final verification pass for Discovery Engine scouting"
```
