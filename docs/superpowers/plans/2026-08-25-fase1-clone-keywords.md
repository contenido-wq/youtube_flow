# Discovery Engine — Clonar Canal y Keywords/Títulos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el Discovery Engine (spec 5.3, 5.4): que el equipo pueda elegir un canal (propio hallazgo o URL pegada), generar un plan de clonación basado en sus videos de mejor desempeño relativo, y generar keywords + títulos estratégicos para un tema.

**Architecture:** Reutiliza el motor YouTube Data API v3 ya construido para extraer el catálogo completo de un canal (paginado). El análisis de outliers/cadencia es lógica pura y determinística; la generación del plan de clonación y de títulos usa la API de Claude directamente (no existe herramienta dedicada — es tarea de prompting, spec sección 5.3/11), inyectada por dependencia para poder testear sin llamadas reales.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk` (modelo `claude-opus-5`, el default vigente — ver nota de costo en Global Constraints), Supabase (ya conectado, proyecto real), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-fabrica-canales-youtube-design.md` (secciones 5.3, 5.4)

## Global Constraints

- Requiere los dos planes anteriores ya construidos y aplicados (`team_members`, `channels`, `discovery_runs`/`discovery_results`) — ya están live en el proyecto Supabase conectado, así que en este plan las migraciones se aplican de una, sin pasos diferidos.
- **Nunca clonar guion/texto literal**: el prompt de generación del plan de clonación debe instruir explícitamente variación (tema/ángulo, no copiar), inyectando las `variation_rules` del canal destino (spec sección 8, riesgo de "Inauthentic Content").
- Outliers = videos cuyo `viewCount` supera la **mediana** (no el promedio, para no distorsionar con un solo video viral) del catálogo del canal por un multiplicador configurable (default 2x).
- Modelo Claude: `claude-opus-5` (default vigente según el skill de Claude API). Si el costo a escala de "fábrica" preocupa, cambiar de modelo es una decisión del usuario, no una que el código tome solo — dejar el modelo como constante fácil de cambiar en un solo lugar.
- Todas las llamadas a Claude/Keywords Everywhere reciben el cliente HTTP/SDK por inyección de dependencia — nunca instanciado dentro de la función — para poder testear con un cliente falso sin red real.
- Roles: solo `admin`/`investigador` pueden disparar clonación o generación de keywords/títulos (misma regla que scouting).

---

## Mapa de archivos

```
supabase/migrations/<timestamp>_clone_plans.sql
lib/discovery/clone-analysis.ts          # calculateUploadCadence, findOutlierVideos (puras)
lib/discovery/clone-analysis.test.ts
lib/discovery/channel-catalog.ts          # extracción paginada del catálogo completo
lib/discovery/channel-catalog.test.ts
lib/llm/anthropic-client.ts                # wrapper delgado, cliente inyectado
lib/discovery/clone-plan-generator.ts      # prompt + parseo de respuesta
lib/discovery/clone-plan-generator.test.ts
lib/keywords/keywords-everywhere-client.ts
lib/keywords/keywords-everywhere-client.test.ts
lib/titles/generate-titles.ts
lib/titles/generate-titles.test.ts
app/(protected)/canales/[id]/clonar/page.tsx
app/(protected)/canales/[id]/clonar/actions.ts
app/(protected)/canales/[id]/keywords/page.tsx
app/(protected)/canales/[id]/keywords/actions.ts
.env.example                                # + ANTHROPIC_API_KEY, KEYWORDS_EVERYWHERE_API_KEY
```

---

### Task 1: Schema de `channel_clone_plans` y `clone_plan_items` con RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_clone_plans.sql`
- Test: `tests/rls/clone-plans.test.ts`

**Interfaces:**
- Consumes: `private.get_my_role()`, `public.team_members`, `public.channels`.
- Produces: tablas `public.channel_clone_plans`, `public.clone_plan_items`.

- [ ] **Step 1: Crear la migración**

```bash
npx supabase migration new clone_plans
```

- [ ] **Step 2: Escribir el test que falla**

`tests/rls/clone-plans.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: channel_clone_plans / clone_plan_items', () => {
  const createdUserIds: string[] = []
  const createdChannelIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  async function makeChannel(client: Awaited<ReturnType<typeof createTestUser>>['client'], userId: string) {
    const { data } = await client
      .from('channels')
      .insert({
        name: 'Canal de prueba clon',
        niche: 'finanzas personales',
        target_language: 'es',
        variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
        created_by: userId,
      })
      .select()
      .single()
    createdChannelIds.push(data!.id)
    return data!.id
  }

  it('un investigador puede crear un clone_plan y sus items', async () => {
    const user = await createTestUser('investigador', 'inv-clone')
    createdUserIds.push(user.userId)
    const channelId = await makeChannel(user.client, user.userId)

    const { data: plan, error: planError } = await user.client
      .from('channel_clone_plans')
      .insert({
        channel_id: channelId,
        source_youtube_channel_id: 'UC_source123',
        source_channel_title: 'Canal Fuente',
        analyzed_video_count: 20,
        upload_cadence_per_week: 3,
        avg_duration_seconds: 480,
        status: 'completed',
        created_by: user.userId,
      })
      .select()
      .single()

    expect(planError).toBeNull()

    const { error: itemError } = await user.client.from('clone_plan_items').insert({
      clone_plan_id: plan!.id,
      source_video_title: 'Cómo ahorrar tu primer millón',
      source_video_views: 500000,
      proposed_topic: 'Cómo ahorrar tu primer millón (adaptado)',
      proposed_angle: 'Ángulo distinto: enfoque en errores comunes en vez de pasos',
    })

    expect(itemError).toBeNull()
  })

  it('un guionista no puede crear un clone_plan', async () => {
    const user = await createTestUser('guionista', 'guion-clone')
    createdUserIds.push(user.userId)

    const { error } = await user.client.from('channel_clone_plans').insert({
      channel_id: '00000000-0000-0000-0000-000000000000',
      source_youtube_channel_id: 'UC_x',
      source_channel_title: 'X',
      analyzed_video_count: 0,
      upload_cadence_per_week: 0,
      avg_duration_seconds: 0,
      created_by: user.userId,
    })

    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- tests/rls/clone-plans.test.ts`
Expected: FAIL — `relation "public.channel_clone_plans" does not exist`.

- [ ] **Step 4: Escribir la migración**

```sql
create table public.channel_clone_plans (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  source_youtube_channel_id text not null,
  source_channel_title text not null,
  analyzed_video_count int not null,
  upload_cadence_per_week numeric not null,
  avg_duration_seconds numeric not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_by uuid not null references public.team_members(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.clone_plan_items (
  id uuid primary key default gen_random_uuid(),
  clone_plan_id uuid not null references public.channel_clone_plans(id) on delete cascade,
  source_video_title text not null,
  source_video_views bigint not null,
  proposed_topic text not null,
  proposed_angle text not null,
  status text not null default 'proposed' check (status in ('proposed', 'loaded_to_production', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.channel_clone_plans enable row level security;
alter table public.clone_plan_items enable row level security;

grant select, insert, update, delete on public.channel_clone_plans to authenticated;
grant select, insert, update, delete on public.clone_plan_items to authenticated;

create policy "clone_plans_select_all_authenticated"
  on public.channel_clone_plans for select to authenticated using (true);

create policy "clone_plans_insert_admin_investigador"
  on public.channel_clone_plans for insert to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "clone_plans_update_admin_investigador"
  on public.channel_clone_plans for update to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "clone_plan_items_select_all_authenticated"
  on public.clone_plan_items for select to authenticated using (true);

create policy "clone_plan_items_insert_admin_investigador"
  on public.clone_plan_items for insert to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "clone_plan_items_update_admin_investigador"
  on public.clone_plan_items for update to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));
```

- [ ] **Step 5: Aplicar la migración al proyecto conectado**

```bash
npx supabase db push
```

Expected: aplica `clone_plans` sin errores (las migraciones anteriores ya están aplicadas, `db push` solo corre las nuevas).

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npm test -- tests/rls/clone-plans.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Advisors + regenerar tipos**

```bash
npx supabase db advisors --linked --type security
npx supabase gen types typescript --linked > types/database.ts
```

Expected: sin issues de seguridad nuevos.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations tests/rls/clone-plans.test.ts types/database.ts
git commit -m "feat: add channel_clone_plans and clone_plan_items tables with RLS"
```

---

### Task 2: Análisis de outliers y cadencia (funciones puras)

**Files:**
- Create: `lib/discovery/clone-analysis.ts`
- Test: `lib/discovery/clone-analysis.test.ts`

**Interfaces:**
- Produces: `calculateUploadCadence(videos: {publishedAt: string}[]): number`, `findOutlierVideos<T extends {viewCount: number}>(videos: T[], multiplier?: number): T[]`.

- [ ] **Step 1: Escribir el test que falla**

`lib/discovery/clone-analysis.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateUploadCadence, findOutlierVideos } from './clone-analysis'

describe('calculateUploadCadence', () => {
  it('calcula videos por semana a partir de fechas de publicación', () => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const videos = [
      { publishedAt: new Date(now).toISOString() },
      { publishedAt: new Date(now - 7 * day).toISOString() },
      { publishedAt: new Date(now - 14 * day).toISOString() },
      { publishedAt: new Date(now - 21 * day).toISOString() },
    ]
    // 4 videos en 21 días de ventana ≈ 1.33 videos/semana
    expect(calculateUploadCadence(videos)).toBeCloseTo(1.33, 1)
  })

  it('devuelve 0 con un solo video (no hay ventana de tiempo)', () => {
    expect(calculateUploadCadence([{ publishedAt: new Date().toISOString() }])).toBe(0)
  })
})

describe('findOutlierVideos', () => {
  it('identifica videos que superan la mediana por el multiplicador', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1200 },
      { title: 'c', viewCount: 1100 },
      { title: 'd', viewCount: 50000 }, // outlier claro
    ]
    const outliers = findOutlierVideos(videos)
    expect(outliers).toHaveLength(1)
    expect(outliers[0].title).toBe('d')
  })

  it('no distorsiona con un solo outlier extremo (usa mediana, no promedio)', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1100 },
      { title: 'c', viewCount: 1000000 }, // no debería inflar el umbral para los demás
    ]
    const outliers = findOutlierVideos(videos)
    expect(outliers.map((v) => v.title)).toEqual(['c'])
  })

  it('respeta un multiplicador custom', () => {
    const videos = [
      { title: 'a', viewCount: 1000 },
      { title: 'b', viewCount: 1000 },
      { title: 'c', viewCount: 1500 },
    ]
    expect(findOutlierVideos(videos, 1.2)).toHaveLength(1)
    expect(findOutlierVideos(videos, 3)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/clone-analysis.test.ts`
Expected: FAIL — no se puede importar `./clone-analysis`.

- [ ] **Step 3: Implementar**

`lib/discovery/clone-analysis.ts`:

```typescript
export function calculateUploadCadence(videos: { publishedAt: string }[]): number {
  if (videos.length < 2) return 0

  const timestamps = videos.map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => a - b)
  const windowDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
  if (windowDays === 0) return 0

  return (videos.length / windowDays) * 7
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const DEFAULT_OUTLIER_MULTIPLIER = 2

export function findOutlierVideos<T extends { viewCount: number }>(
  videos: T[],
  multiplier: number = DEFAULT_OUTLIER_MULTIPLIER
): T[] {
  if (videos.length === 0) return []

  const medianViews = median(videos.map((v) => v.viewCount))
  return videos.filter((v) => v.viewCount > medianViews * multiplier)
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/clone-analysis.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/clone-analysis.ts lib/discovery/clone-analysis.test.ts
git commit -m "feat: add outlier detection and upload cadence analysis"
```

---

### Task 3: Extracción del catálogo completo de un canal (paginada)

**Files:**
- Create: `lib/discovery/channel-catalog.ts`
- Test: `lib/discovery/channel-catalog.test.ts`

**Interfaces:**
- Consumes: `parseISO8601Duration` (de `./duration.ts`, ya existente).
- Produces: `getChannelCatalog(apiKey: string, youtubeChannelId: string, maxPages?: number): Promise<CatalogVideo[]>`, `interface CatalogVideo { videoId: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number }`.

- [ ] **Step 1: Escribir el test que falla (fetch mockeado)**

`lib/discovery/channel-catalog.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getChannelCatalog } from './channel-catalog'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('getChannelCatalog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pagina playlistItems hasta agotar nextPageToken o maxPages, luego hidrata con videos.list', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    // 1. channels.list -> uploads playlist
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_x' } } }] })
    )
    // 2. playlistItems.list página 1 (con nextPageToken)
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        nextPageToken: 'PAGE2',
        items: [{ contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-01T00:00:00Z' } }],
      })
    )
    // 3. playlistItems.list página 2 (sin nextPageToken)
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [{ contentDetails: { videoId: 'v2', videoPublishedAt: '2026-07-01T00:00:00Z' } }],
      })
    )
    // 4. videos.list para v1 + v2
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', snippet: { title: 'Video 1' }, statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
          { id: 'v2', snippet: { title: 'Video 2' }, statistics: { viewCount: '2000' }, contentDetails: { duration: 'PT3M' } },
        ],
      })
    )

    const catalog = await getChannelCatalog('fake-key', 'UC_x')

    expect(catalog).toHaveLength(2)
    expect(catalog[0]).toEqual({
      videoId: 'v1',
      title: 'Video 1',
      publishedAt: '2026-08-01T00:00:00Z',
      viewCount: 1000,
      durationSeconds: 300,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('respeta maxPages aunque haya más páginas disponibles', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_x' } } }] })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        nextPageToken: 'PAGE2',
        items: [{ contentDetails: { videoId: 'v1', videoPublishedAt: '2026-08-01T00:00:00Z' } }],
      })
    )
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        items: [
          { id: 'v1', snippet: { title: 'Video 1' }, statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
        ],
      })
    )

    const catalog = await getChannelCatalog('fake-key', 'UC_x', 1)

    expect(catalog).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3) // channels.list + 1 página de playlistItems + videos.list, sin página 2
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/channel-catalog.test.ts`
Expected: FAIL — no se puede importar `./channel-catalog`.

- [ ] **Step 3: Implementar**

`lib/discovery/channel-catalog.ts`:

```typescript
import { parseISO8601Duration } from './duration'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface CatalogVideo {
  videoId: string
  title: string
  publishedAt: string
  viewCount: number
  durationSeconds: number
}

export async function getChannelCatalog(
  apiKey: string,
  youtubeChannelId: string,
  maxPages: number = 4
): Promise<CatalogVideo[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(apiKey, youtubeChannelId)
  if (!uploadsPlaylistId) return []

  const videoRefs: { videoId: string; publishedAt: string }[] = []
  let pageToken: string | undefined
  let pagesFetched = 0

  do {
    const page = await getPlaylistPage(apiKey, uploadsPlaylistId, pageToken)
    videoRefs.push(...page.items)
    pageToken = page.nextPageToken
    pagesFetched += 1
  } while (pageToken && pagesFetched < maxPages)

  if (videoRefs.length === 0) return []

  const stats = await getVideoDetails(apiKey, videoRefs.map((v) => v.videoId))
  const publishedAtByVideoId = new Map(videoRefs.map((v) => [v.videoId, v.publishedAt]))

  return stats.map((s) => ({
    videoId: s.videoId,
    title: s.title,
    publishedAt: publishedAtByVideoId.get(s.videoId) ?? '',
    viewCount: s.viewCount,
    durationSeconds: s.durationSeconds,
  }))
}

async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string | undefined> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
}

async function getPlaylistPage(
  apiKey: string,
  playlistId: string,
  pageToken: string | undefined
): Promise<{ items: { videoId: string; publishedAt: string }[]; nextPageToken: string | undefined }> {
  const url = new URL(`${BASE_URL}/playlistItems`)
  url.searchParams.set('part', 'contentDetails')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('key', apiKey)
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const response = await fetch(url.toString())
  const data = await response.json()

  return {
    items: (data.items ?? []).map((item: { contentDetails: { videoId: string; videoPublishedAt: string } }) => ({
      videoId: item.contentDetails.videoId,
      publishedAt: item.contentDetails.videoPublishedAt,
    })),
    nextPageToken: data.nextPageToken,
  }
}

async function getVideoDetails(
  apiKey: string,
  videoIds: string[]
): Promise<{ videoId: string; title: string; viewCount: number; durationSeconds: number }[]> {
  const url = new URL(`${BASE_URL}/videos`)
  url.searchParams.set('part', 'snippet,statistics,contentDetails')
  url.searchParams.set('id', videoIds.join(','))
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  return (data.items ?? []).map(
    (item: {
      id: string
      snippet: { title: string }
      statistics: { viewCount?: string }
      contentDetails: { duration: string }
    }) => ({
      videoId: item.id,
      title: item.snippet.title,
      viewCount: Number(item.statistics.viewCount ?? 0),
      durationSeconds: parseISO8601Duration(item.contentDetails.duration),
    })
  )
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/channel-catalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/channel-catalog.ts lib/discovery/channel-catalog.test.ts
git commit -m "feat: add paginated full-channel-catalog extraction"
```

---

### Task 4: Generador de plan de clonación (Claude API)

**Files:**
- Create: `lib/llm/anthropic-client.ts`
- Create: `lib/discovery/clone-plan-generator.ts`
- Test: `lib/discovery/clone-plan-generator.test.ts`

**Interfaces:**
- Consumes: `findOutlierVideos` (Task 2).
- Produces: `type AnthropicMessagesClient = { messages: { create(params: unknown): Promise<{ content: { type: string; text?: string }[] }> } }` (sintaxis de método, no propiedad — importa para la varianza de tipos, ver Step 1), `generateClonePlanItems(client: AnthropicMessagesClient, input: ClonePlanInput): Promise<ClonePlanItem[]>`.

- [ ] **Step 1: Wrapper delgado del cliente Anthropic**

`lib/llm/anthropic-client.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Modelo por defecto vigente (ver skill de Claude API) — cambiarlo aquí
// afecta a todo el pipeline de generación (clonación + títulos).
export const CLAUDE_MODEL = 'claude-opus-5'

// Forma mínima que necesitan los generadores — permite inyectar un cliente
// falso en tests sin depender de los tipos completos (y sobrecargados) del
// SDK real. `Anthropic` real es estructuralmente compatible con esto.
export type AnthropicMessagesClient = {
  messages: {
    // Sintaxis de método (no propiedad con tipo función): TypeScript la
    // chequea de forma bivariante, así que el cliente real del SDK (cuyo
    // `create` espera un tipo de parámetro más específico que `unknown`)
    // sigue siendo asignable aquí. Con `create: (params: unknown) => ...`
    // como propiedad, el chequeo contravariante estricto lo rechazaría.
    create(params: unknown): Promise<{ content: { type: string; text?: string }[] }>
  }
}

export function createAnthropicClient(): AnthropicMessagesClient {
  return new Anthropic()
}

export function extractText(content: { type: string; text?: string }[]): string {
  const textBlock = content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}
```

- [ ] **Step 2: Escribir el test que falla (cliente Anthropic falso, sin red real)**

`lib/discovery/clone-plan-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateClonePlanItems } from './clone-plan-generator'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('generateClonePlanItems', () => {
  const baseInput = {
    channelNiche: 'finanzas personales',
    channelVariationRules: 'Variar el ángulo del hook y los ejemplos en cada video.',
    outlierVideos: [
      { title: 'Cómo ahorrar tu primer millón', viewCount: 500000 },
      { title: '5 errores que te mantienen pobre', viewCount: 300000 },
    ],
  }

  it('parsea la respuesta JSON de Claude en items de plan de clonación', async () => {
    const client = fakeAnthropicClient(
      JSON.stringify([
        { sourceVideoTitle: 'Cómo ahorrar tu primer millón', proposedTopic: 'El primer millón: mitos y realidades', proposedAngle: 'Enfoque en mitos comunes en vez de pasos' },
      ])
    )

    const items = await generateClonePlanItems(client, baseInput)

    expect(items).toHaveLength(1)
    expect(items[0].sourceVideoTitle).toBe('Cómo ahorrar tu primer millón')
    expect(items[0].proposedTopic).toBe('El primer millón: mitos y realidades')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('esto no es JSON')

    await expect(generateClonePlanItems(client, baseInput)).rejects.toThrow(/JSON/)
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- lib/discovery/clone-plan-generator.test.ts`
Expected: FAIL — no se puede importar `./clone-plan-generator`.

- [ ] **Step 4: Implementar**

`lib/discovery/clone-plan-generator.ts`:

```typescript
import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface ClonePlanInput {
  channelNiche: string
  channelVariationRules: string
  outlierVideos: { title: string; viewCount: number }[]
}

export interface ClonePlanItem {
  sourceVideoTitle: string
  proposedTopic: string
  proposedAngle: string
}

export async function generateClonePlanItems(
  client: AnthropicMessagesClient,
  input: ClonePlanInput
): Promise<ClonePlanItem[]> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      'Eres un estratega de contenido para un canal de YouTube faceless. ' +
      'A partir de videos de mejor desempeño de OTRO canal en el mismo nicho, propones temas ' +
      'para el canal del usuario. NUNCA copies el guion o el texto literal — solo el tema y el ' +
      'ángulo estratégico. Cada tema propuesto debe respetar las reglas de variación del canal ' +
      'para evitar contenido templado sin variación creativa. Responde ÚNICAMENTE con un array ' +
      'JSON válido, sin texto adicional, con el formato: ' +
      '[{"sourceVideoTitle": string, "proposedTopic": string, "proposedAngle": string}]',
    messages: [
      {
        role: 'user',
        content:
          `Nicho del canal: ${input.channelNiche}\n` +
          `Reglas de variación obligatoria: ${input.channelVariationRules}\n\n` +
          `Videos de mejor desempeño del canal fuente:\n` +
          input.outlierVideos.map((v) => `- "${v.title}" (${v.viewCount} vistas)`).join('\n'),
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as ClonePlanItem[]
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el plan de clonación: ${text.slice(0, 200)}`)
  }
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test -- lib/discovery/clone-plan-generator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Instalar el SDK de Anthropic y agregar la variable de entorno**

```bash
npm install @anthropic-ai/sdk
```

Agregar a `.env.example`: `ANTHROPIC_API_KEY=`

- [ ] **Step 7: Commit**

```bash
git add lib/llm lib/discovery/clone-plan-generator.ts lib/discovery/clone-plan-generator.test.ts .env.example package.json package-lock.json
git commit -m "feat: add Claude-based clone plan generator"
```

---

### Task 5: Cliente de Keywords Everywhere

**Files:**
- Create: `lib/keywords/keywords-everywhere-client.ts`
- Test: `lib/keywords/keywords-everywhere-client.test.ts`

**Interfaces:**
- Produces: `getKeywordData(apiKey: string, keywords: string[]): Promise<KeywordData[]>`, `interface KeywordData { keyword: string; volume: number; cpc: number; competition: number }`.

- [ ] **Step 1: Escribir el test que falla (fetch mockeado)**

`lib/keywords/keywords-everywhere-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getKeywordData } from './keywords-everywhere-client'

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('getKeywordData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mapea la respuesta de la API a KeywordData[]', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        data: [
          { keyword: 'ahorrar dinero', vol: 12000, cpc: { value: '0.85' }, competition: 0.4 },
        ],
      })
    )

    const result = await getKeywordData('fake-key', ['ahorrar dinero'])

    expect(result).toEqual([{ keyword: 'ahorrar dinero', volume: 12000, cpc: 0.85, competition: 0.4 }])
  })

  it('devuelve un array vacío si la API no trae datos', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(() => jsonResponse({ data: [] }))

    const result = await getKeywordData('fake-key', ['algo raro'])

    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/keywords/keywords-everywhere-client.test.ts`
Expected: FAIL — no se puede importar `./keywords-everywhere-client`.

- [ ] **Step 3: Implementar**

`lib/keywords/keywords-everywhere-client.ts`:

```typescript
export interface KeywordData {
  keyword: string
  volume: number
  cpc: number
  competition: number
}

export async function getKeywordData(apiKey: string, keywords: string[]): Promise<KeywordData[]> {
  const body = new URLSearchParams()
  keywords.forEach((k) => body.append('kw[]', k))
  body.append('country', 'us')
  body.append('currency', 'USD')
  body.append('dataSource', 'gkp')

  const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await response.json()

  return (data.data ?? []).map((item: { keyword: string; vol: number; cpc: { value: string }; competition: number }) => ({
    keyword: item.keyword,
    volume: item.vol,
    cpc: Number(item.cpc.value),
    competition: item.competition,
  }))
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/keywords/keywords-everywhere-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Agregar la variable de entorno**

Agregar a `.env.example`: `KEYWORDS_EVERYWHERE_API_KEY=`

- [ ] **Step 6: Commit**

```bash
git add lib/keywords .env.example
git commit -m "feat: add Keywords Everywhere API client"
```

---

### Task 6: Generador de títulos estratégicos (Claude API)

**Files:**
- Create: `lib/titles/generate-titles.ts`
- Test: `lib/titles/generate-titles.test.ts`

**Interfaces:**
- Consumes: `CLAUDE_MODEL`, `extractText`, `AnthropicMessagesClient` (Task 4), `KeywordData` (Task 5).
- Produces: `generateTitles(client: AnthropicMessagesClient, topic: string, keywordData: KeywordData[]): Promise<string[]>`.

- [ ] **Step 1: Escribir el test que falla**

`lib/titles/generate-titles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateTitles } from './generate-titles'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

describe('generateTitles', () => {
  it('parsea la respuesta JSON de Claude en un array de títulos', async () => {
    const client = fakeAnthropicClient(JSON.stringify(['Cómo ahorrar tu primer millón (sin sacrificar tu vida)', '5 errores que te mantienen pobre']))

    const titles = await generateTitles(client, 'ahorro para principiantes', [
      { keyword: 'ahorrar dinero', volume: 12000, cpc: 0.85, competition: 0.4 },
    ])

    expect(titles).toHaveLength(2)
    expect(titles[0]).toContain('millón')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(generateTitles(client, 'tema', [])).rejects.toThrow(/JSON/)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/titles/generate-titles.test.ts`
Expected: FAIL — no se puede importar `./generate-titles`.

- [ ] **Step 3: Implementar**

`lib/titles/generate-titles.ts`:

```typescript
import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'
import type { KeywordData } from '@/lib/keywords/keywords-everywhere-client'

export async function generateTitles(
  client: AnthropicMessagesClient,
  topic: string,
  keywordData: KeywordData[]
): Promise<string[]> {
  const keywordSummary = keywordData
    .map((k) => `- "${k.keyword}" (volumen: ${k.volume}, competencia: ${k.competition})`)
    .join('\n')

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      'Eres un experto en títulos de YouTube de alto CTR (curiosidad, contraste, 3-4 palabras clave ' +
      'máximo). Genera 5-10 títulos estratégicos para el tema dado, incorporando naturalmente las ' +
      'keywords de mayor volumen cuando encajen. Responde ÚNICAMENTE con un array JSON de strings.',
    messages: [
      {
        role: 'user',
        content: `Tema: ${topic}\n\nDatos de keywords:\n${keywordSummary || '(sin datos de keywords)'}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as string[]
  } catch {
    throw new Error(`Claude no devolvió JSON válido para los títulos: ${text.slice(0, 200)}`)
  }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/titles/generate-titles.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/titles
git commit -m "feat: add Claude-based strategic title generator"
```

---

### Task 7: UI — Clonar Canal y Keywords/Títulos

**Files:**
- Create: `app/(protected)/canales/[id]/clonar/actions.ts`
- Create: `app/(protected)/canales/[id]/clonar/page.tsx`
- Create: `app/(protected)/canales/[id]/keywords/actions.ts`
- Create: `app/(protected)/canales/[id]/keywords/page.tsx`

**Interfaces:**
- Consumes: `getChannelCatalog` (Task 3), `calculateUploadCadence`/`findOutlierVideos` (Task 2), `generateClonePlanItems` (Task 4), `getKeywordData` (Task 5), `generateTitles` (Task 6), `createAnthropicClient` (Task 4).

- [ ] **Step 1: Server action de clonación**

`app/(protected)/canales/[id]/clonar/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { getChannelCatalog } from '@/lib/discovery/channel-catalog'
import { calculateUploadCadence, findOutlierVideos } from '@/lib/discovery/clone-analysis'
import { generateClonePlanItems } from '@/lib/discovery/clone-plan-generator'
import { redirect } from 'next/navigation'

export async function runClonePlan(channelId: string, sourceYoutubeChannelId: string, sourceChannelTitle: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { planId: null, error: 'No autenticado' }

  const { data: channel } = await supabase.from('channels').select('niche, variation_rules').eq('id', channelId).single()
  if (!channel) return { planId: null, error: 'Canal no encontrado' }

  const catalog = await getChannelCatalog(process.env.YOUTUBE_API_KEY!, sourceYoutubeChannelId)
  const cadence = calculateUploadCadence(catalog)
  const avgDuration = catalog.reduce((sum, v) => sum + v.durationSeconds, 0) / (catalog.length || 1)
  const outliers = findOutlierVideos(catalog)

  const { data: plan, error: planError } = await supabase
    .from('channel_clone_plans')
    .insert({
      channel_id: channelId,
      source_youtube_channel_id: sourceYoutubeChannelId,
      source_channel_title: sourceChannelTitle,
      analyzed_video_count: catalog.length,
      upload_cadence_per_week: cadence,
      avg_duration_seconds: avgDuration,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (planError || !plan) return { planId: null, error: planError?.message ?? 'Error creando el plan' }

  try {
    const anthropic = createAnthropicClient()
    const items = await generateClonePlanItems(anthropic, {
      channelNiche: channel.niche,
      channelVariationRules: channel.variation_rules,
      outlierVideos: outliers,
    })

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('clone_plan_items').insert(
        items.map((item, index) => ({
          clone_plan_id: plan.id,
          source_video_title: item.sourceVideoTitle,
          source_video_views: outliers[index]?.viewCount ?? 0,
          proposed_topic: item.proposedTopic,
          proposed_angle: item.proposedAngle,
        }))
      )
      if (itemsError) throw new Error(itemsError.message)
    }

    await supabase.from('channel_clone_plans').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', plan.id)
  } catch (err) {
    await supabase
      .from('channel_clone_plans')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', plan.id)
    return { planId: plan.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/canales/${channelId}/clonar?planId=${plan.id}`)
}
```

- [ ] **Step 2: Página de Clonar Canal**

`app/(protected)/canales/[id]/clonar/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { runClonePlan } from './actions'

export default async function ClonarCanalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ planId?: string }>
}) {
  const { id: channelId } = await params
  const { planId } = await searchParams
  const supabase = await createClient()

  async function handleSubmit(formData: FormData) {
    'use server'
    await runClonePlan(
      channelId,
      formData.get('sourceYoutubeChannelId') as string,
      formData.get('sourceChannelTitle') as string
    )
  }

  const items = planId
    ? (await supabase.from('clone_plan_items').select('*').eq('clone_plan_id', planId)).data
    : null

  return (
    <div>
      <h1>Clonar canal</h1>
      <form action={handleSubmit}>
        <input name="sourceYoutubeChannelId" placeholder="ID del canal de YouTube (ej. UC...)" required />
        <input name="sourceChannelTitle" placeholder="Nombre del canal fuente" required />
        <button type="submit">Generar plan de clonación</button>
      </form>

      {items && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.proposed_topic}</strong> — {item.proposed_angle}
              <br />
              <small>Inspirado en: &quot;{item.source_video_title}&quot; ({item.source_video_views} vistas)</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Server action de keywords + títulos**

`app/(protected)/canales/[id]/keywords/actions.ts`:

```typescript
'use server'

import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { getKeywordData } from '@/lib/keywords/keywords-everywhere-client'
import { generateTitles } from '@/lib/titles/generate-titles'

export async function researchTopic(topic: string) {
  const keywordData = await getKeywordData(process.env.KEYWORDS_EVERYWHERE_API_KEY!, [topic])
  const anthropic = createAnthropicClient()
  const titles = await generateTitles(anthropic, topic, keywordData)

  return { keywordData, titles }
}
```

- [ ] **Step 4: Página de Keywords + Títulos**

`app/(protected)/canales/[id]/keywords/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { researchTopic } from './actions'
import type { KeywordData } from '@/lib/keywords/keywords-everywhere-client'

export default function KeywordsPage() {
  const [topic, setTopic] = useState('')
  const [keywordData, setKeywordData] = useState<KeywordData[]>([])
  const [titles, setTitles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await researchTopic(topic)
    setKeywordData(result.keywordData)
    setTitles(result.titles)
    setLoading(false)
  }

  return (
    <div>
      <h1>Keywords y títulos</h1>
      <form onSubmit={handleSubmit}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema del video" required />
        <button type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Investigar'}</button>
      </form>

      {keywordData.length > 0 && (
        <>
          <h2>Keywords</h2>
          <ul>
            {keywordData.map((k) => (
              <li key={k.keyword}>{k.keyword} — volumen: {k.volume}, competencia: {k.competition}</li>
            ))}
          </ul>
        </>
      )}

      {titles.length > 0 && (
        <>
          <h2>Títulos propuestos</h2>
          <ul>
            {titles.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar lint y build**

```bash
npm run lint
npm run build
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/canales/[id]/clonar" "app/(protected)/canales/[id]/keywords"
git commit -m "feat: add Clonar Canal and Keywords/Títulos pages"
```

---

### Task 8: Verificación final

- [ ] **Step 1: Suite completa de tests**

Run: `npm test`
Expected: todos los tests pasan, incluyendo los de RLS contra el proyecto real.

- [ ] **Step 2: Lint y build**

```bash
npm run lint
npm run build
```

Expected: sin errores.

- [ ] **Step 3: Advisors de seguridad final**

```bash
npx supabase db advisors --linked --type security
```

Expected: sin issues.

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: final verification pass for Clonar Canal + Keywords/Títulos"
```
