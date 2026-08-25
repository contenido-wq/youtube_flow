# Script Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el equipo pueda generar el guion de un video (con duración objetivo, estilo estándar o personalizado por transcripción de referencia, y el paquete SEO completo) y luego dividirlo en bloques coherentes para locución — spec sección 6.

**Architecture:** Nueva tabla `videos` (primer uso real de esta entidad núcleo del spec, sección 4) más `voice_pace_calibration` para la conversión duración→caracteres. Generación de guion+SEO vía Claude API con el mismo patrón de cliente inyectado ya usado en Clonar Canal/Títulos (testeable sin red real). División en bloques es lógica pura basada en límites de oración con regex, sin IA.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk` (ya instalado), Supabase (proyecto real ya conectado), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-fabrica-canales-youtube-design.md` (sección 6), `docs/superpowers/specs/2026-08-25-scripsy-gap-analysis.md`

## Global Constraints

- Requiere los planes de Fase 1 ya construidos (`team_members`, `channels`) — ya están live en el proyecto Supabase conectado; las migraciones de este plan se aplican de una vez, sin pasos diferidos.
- Tasa de caracteres por minuto: no hay Voice Factory todavía para calibrar empíricamente (spec 6.1), así que se usa un valor por defecto documentado (750 caracteres/minuto, derivado de la referencia de Scripsy: 60,000 caracteres ≈ 80 minutos) guardado en `voice_pace_calibration` como fila semilla — la tabla ya queda lista para que el Voice Factory la actualice cuando exista.
- Margen de sobra (spec 6.2): +12% por defecto sobre el conteo de caracteres estimado, configurable por llamada.
- Nunca clonar guion literal ni en estilo "Personalizado" — el prompt debe instruir replicar patrón estructural, no copiar texto, misma regla que Clonar Canal.
- División en bloques (spec 6.5) es lógica pura (regex sobre límites de oración), no una llamada a IA — debe ser determinística y barata.
- Roles: solo `admin`/`investigador` pueden generar guiones (misma regla que el resto del Discovery Engine).
- El campo `status` de `videos` en esta entrega solo cubre el ciclo de generación de guion (`pending`/`generating`/`scripted`/`failed`) — el enum completo del pipeline (`scouted → ... → exported`, spec sección 3) se amplía cuando se construyan Voice/Visual/Thumbnail Factory, no antes (YAGNI).

---

## Mapa de archivos

```
supabase/migrations/<timestamp>_videos.sql
lib/scripts/duration-estimate.ts        # estimateTargetCharacterCount (función pura)
lib/scripts/duration-estimate.test.ts
lib/scripts/block-splitter.ts            # splitIntoCoherentBlocks (función pura)
lib/scripts/block-splitter.test.ts
lib/scripts/generate-script.ts            # prompt + parseo (Claude)
lib/scripts/generate-script.test.ts
app/(protected)/canales/[id]/guiones/page.tsx
app/(protected)/canales/[id]/guiones/nuevo/page.tsx
app/(protected)/canales/[id]/guiones/nuevo/actions.ts
app/(protected)/canales/[id]/guiones/[videoId]/page.tsx
app/(protected)/canales/[id]/guiones/[videoId]/actions.ts
```

---

### Task 1: Schema de `videos` y `voice_pace_calibration` con RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_videos.sql`
- Test: `tests/rls/videos.test.ts`

**Interfaces:**
- Consumes: `private.get_my_role()`, `public.team_members`, `public.channels`.
- Produces: tablas `public.videos`, `public.voice_pace_calibration`.

- [ ] **Step 1: Crear la migración**

```bash
npx supabase migration new videos
```

- [ ] **Step 2: Escribir el test que falla**

`tests/rls/videos.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from '../helpers/supabase-test-client'

describe('RLS: videos', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    while (createdUserIds.length) await deleteTestUser(createdUserIds.pop()!)
  })

  async function makeChannel(client: Awaited<ReturnType<typeof createTestUser>>['client'], userId: string) {
    const { data } = await client
      .from('channels')
      .insert({
        name: 'Canal de prueba guiones',
        niche: 'finanzas personales',
        target_language: 'es',
        variation_rules: 'Variar el ángulo del hook y los ejemplos en cada video.',
        created_by: userId,
      })
      .select()
      .single()
    return data!.id
  }

  it('un investigador puede crear un video (guion)', async () => {
    const user = await createTestUser('investigador', 'inv-video')
    createdUserIds.push(user.userId)
    const channelId = await makeChannel(user.client, user.userId)

    const { error } = await user.client.from('videos').insert({
      channel_id: channelId,
      topic: 'Cómo ahorrar tu primer millón',
      target_duration_seconds: 480,
      target_character_count: 6600,
      style: 'estandar',
      created_by: user.userId,
    })

    expect(error).toBeNull()
  })

  it('un guionista no puede crear un video', async () => {
    const user = await createTestUser('guionista', 'guion-video')
    createdUserIds.push(user.userId)

    const { error } = await user.client.from('videos').insert({
      channel_id: '00000000-0000-0000-0000-000000000000',
      topic: 'x',
      target_duration_seconds: 60,
      target_character_count: 750,
      created_by: user.userId,
    })

    expect(error).not.toBeNull()
  })

  it('cualquier autenticado puede leer voice_pace_calibration', async () => {
    const user = await createTestUser('guionista', 'guion-calib')
    createdUserIds.push(user.userId)

    const { data, error } = await user.client.from('voice_pace_calibration').select('*')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test -- tests/rls/videos.test.ts`
Expected: FAIL — `relation "public.videos" does not exist`.

- [ ] **Step 4: Escribir la migración**

```sql
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  topic text not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'scripted', 'failed')),
  error_message text,
  style text not null default 'estandar' check (style in ('estandar', 'personalizado')),
  reference_transcript text,
  target_duration_seconds int not null,
  target_character_count int not null,
  script_content text,
  seo_description text,
  seo_tags text[],
  seo_pinned_comment text,
  seo_thumbnail_phrases text[],
  seo_image_prompt text,
  created_by uuid not null references public.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_pace_calibration (
  id uuid primary key default gen_random_uuid(),
  brand_voice_id text not null,
  target_language text not null,
  chars_per_minute numeric not null,
  updated_at timestamptz not null default now(),
  unique (brand_voice_id, target_language)
);

-- Fila semilla: sin Voice Factory todavía para calibrar, se usa el valor de
-- referencia derivado de Scripsy (60,000 caracteres ≈ 80 minutos = 750/min)
-- para cualquier voz/idioma no calibrado explícitamente.
insert into public.voice_pace_calibration (brand_voice_id, target_language, chars_per_minute)
values ('default', 'default', 750);

alter table public.videos enable row level security;
alter table public.voice_pace_calibration enable row level security;

grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, update, delete on public.voice_pace_calibration to authenticated;

create policy "videos_select_all_authenticated"
  on public.videos for select to authenticated using (true);

create policy "videos_insert_admin_investigador"
  on public.videos for insert to authenticated
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "videos_update_admin_investigador"
  on public.videos for update to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));

create policy "voice_pace_calibration_select_all_authenticated"
  on public.voice_pace_calibration for select to authenticated using (true);

create policy "voice_pace_calibration_write_admin_investigador"
  on public.voice_pace_calibration for all to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));

create trigger videos_set_updated_at
  before update on public.videos
  for each row
  execute function public.set_updated_at();
```

- [ ] **Step 5: Aplicar la migración al proyecto conectado**

```bash
npx supabase db push
```

- [ ] **Step 6: Actualizar `deleteTestUser` para incluir `videos`**

`videos.created_by` referencia `team_members(id)` sin cascade, igual que `channels`/`discovery_runs`/`channel_clone_plans` — sin este paso, cualquier test que cree un `video` directo (no solo vía `channels`) repite el mismo bug de fuga de datos ya corregido antes (ver Global Constraints del plan de Project Hub). Los tests de este plan crean `videos` en el Task 2/4 vía server actions probadas con cliente falso (no tocan la tabla real), pero conviene dejarlo listo ahora para el primer test futuro que sí inserte `videos` directo.

En `tests/helpers/supabase-test-client.ts`, agregar la línea de borrado de `videos` junto a las otras tres:

```typescript
export async function deleteTestUser(userId: string) {
  const admin = serviceClient()

  await admin.from('videos').delete().eq('created_by', userId)
  await admin.from('channels').delete().eq('created_by', userId)
  await admin.from('discovery_runs').delete().eq('created_by', userId)
  await admin.from('channel_clone_plans').delete().eq('created_by', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`No se pudo borrar el usuario de prueba ${userId}: ${error.message}`)
}
```

- [ ] **Step 7: Correr el test y confirmar que pasa**

Run: `npm test -- tests/rls/videos.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Advisors + regenerar tipos**

```bash
npx supabase db advisors --linked --type security
npx supabase gen types typescript --linked > types/database.ts
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations tests/rls/videos.test.ts types/database.ts tests/helpers/supabase-test-client.ts
git commit -m "feat: add videos and voice_pace_calibration tables with RLS"
```

---

### Task 2: Estimador de duración → caracteres (función pura)

**Files:**
- Create: `lib/scripts/duration-estimate.ts`
- Test: `lib/scripts/duration-estimate.test.ts`

**Interfaces:**
- Produces: `estimateTargetCharacterCount(input: { targetDurationSeconds: number; charsPerMinute: number; overshootPercent?: number }): number`.

- [ ] **Step 1: Escribir el test que falla**

`lib/scripts/duration-estimate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { estimateTargetCharacterCount } from './duration-estimate'

describe('estimateTargetCharacterCount', () => {
  it('convierte duración a caracteres usando la tasa dada, con margen de sobra por defecto', () => {
    // 480s = 8 min, 750 chars/min -> 6000 base, +12% = 6720
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 480, charsPerMinute: 750 })
    expect(result).toBe(6720)
  })

  it('respeta un overshootPercent custom', () => {
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 480, charsPerMinute: 750, overshootPercent: 0 })
    expect(result).toBe(6000)
  })

  it('redondea a un entero', () => {
    const result = estimateTargetCharacterCount({ targetDurationSeconds: 63, charsPerMinute: 750 })
    expect(Number.isInteger(result)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/scripts/duration-estimate.test.ts`
Expected: FAIL — no se puede importar `./duration-estimate`.

- [ ] **Step 3: Implementar**

`lib/scripts/duration-estimate.ts`:

```typescript
export interface DurationEstimateInput {
  targetDurationSeconds: number
  charsPerMinute: number
  overshootPercent?: number
}

const DEFAULT_OVERSHOOT_PERCENT = 12

export function estimateTargetCharacterCount(input: DurationEstimateInput): number {
  const overshoot = input.overshootPercent ?? DEFAULT_OVERSHOOT_PERCENT
  const baseCharacters = (input.targetDurationSeconds / 60) * input.charsPerMinute
  return Math.round(baseCharacters * (1 + overshoot / 100))
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/scripts/duration-estimate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scripts/duration-estimate.ts lib/scripts/duration-estimate.test.ts
git commit -m "feat: add duration-to-character-count estimator"
```

---

### Task 3: Divisor coherente por bloques (función pura)

**Files:**
- Create: `lib/scripts/block-splitter.ts`
- Test: `lib/scripts/block-splitter.test.ts`

**Interfaces:**
- Produces: `splitIntoCoherentBlocks(text: string, targetBlockSize: number): string[]`.

- [ ] **Step 1: Escribir el test que falla**

`lib/scripts/block-splitter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { splitIntoCoherentBlocks } from './block-splitter'

describe('splitIntoCoherentBlocks', () => {
  const text =
    'Esta es la primera oración del guion. Esta es la segunda oración, un poco más larga que la anterior. ' +
    'Aquí viene la tercera oración. Y finalmente la cuarta oración cierra el bloque de ejemplo.'

  it('nunca corta una oración a la mitad', () => {
    const blocks = splitIntoCoherentBlocks(text, 60)
    for (const block of blocks) {
      expect(block.trim().endsWith('.')).toBe(true)
    }
  })

  it('reconstruye el texto completo al unir los bloques', () => {
    const blocks = splitIntoCoherentBlocks(text, 60)
    expect(blocks.join(' ')).toBe(text)
  })

  it('con un tamaño objetivo mayor al texto completo, devuelve un solo bloque', () => {
    const blocks = splitIntoCoherentBlocks(text, 10000)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toBe(text)
  })

  it('devuelve un array vacío para texto vacío', () => {
    expect(splitIntoCoherentBlocks('', 100)).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/scripts/block-splitter.test.ts`
Expected: FAIL — no se puede importar `./block-splitter`.

- [ ] **Step 3: Implementar**

`lib/scripts/block-splitter.ts`:

```typescript
// Divide en oraciones conservando el delimitador (. ! ?) al final de cada una.
const SENTENCE_REGEX = /[^.!?]+[.!?]+(?:\s+|$)/g

export function splitIntoCoherentBlocks(text: string, targetBlockSize: number): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return []

  const sentences = (trimmed.match(SENTENCE_REGEX) ?? [trimmed]).map((s) => s.trim())

  const blocks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence

    // Si agregar esta oración se pasa del objetivo Y ya hay contenido
    // acumulado, cierra el bloque actual antes de agregarla — nunca corta
    // una oración a la mitad para "ajustar" al tamaño exacto.
    if (current && candidate.length > targetBlockSize) {
      blocks.push(current)
      current = sentence
    } else {
      current = candidate
    }
  }

  if (current) blocks.push(current)

  return blocks
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/scripts/block-splitter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scripts/block-splitter.ts lib/scripts/block-splitter.test.ts
git commit -m "feat: add coherence-first block splitter for voice-over segmentation"
```

---

### Task 4: Generador de guion + paquete SEO (Claude API)

**Files:**
- Create: `lib/scripts/generate-script.ts`
- Test: `lib/scripts/generate-script.test.ts`

**Interfaces:**
- Consumes: `CLAUDE_MODEL`, `extractText`, `AnthropicMessagesClient` (de `lib/llm/anthropic-client.ts`, ya existente).
- Produces: `generateScript(client: AnthropicMessagesClient, input: GenerateScriptInput): Promise<GeneratedScript>`.

- [ ] **Step 1: Escribir el test que falla**

`lib/scripts/generate-script.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateScript } from './generate-script'

function fakeAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: responseText }] }),
    },
  }
}

const fakeResponse = {
  scriptContent: 'Guion completo de ejemplo.',
  seoDescription: 'Descripción optimizada.',
  seoTags: ['finanzas', 'ahorro'],
  seoPinnedComment: '¿Cuál de estos tips ya aplicas?',
  seoThumbnailPhrases: ['ESTO CAMBIA TODO', 'NADIE TE LO DIJO'],
  seoImagePrompt: 'Persona sorprendida mirando una calculadora, estilo realista',
}

describe('generateScript', () => {
  const baseInput = {
    topic: 'Cómo ahorrar tu primer millón',
    channelNiche: 'finanzas personales',
    channelVariationRules: 'Variar el ángulo del hook y los ejemplos en cada video.',
    targetLanguage: 'es',
    targetCharacterCount: 6720,
    style: 'estandar' as const,
  }

  it('parsea la respuesta JSON de Claude en un guion + paquete SEO', async () => {
    const client = fakeAnthropicClient(JSON.stringify(fakeResponse))

    const result = await generateScript(client, baseInput)

    expect(result.scriptContent).toBe(fakeResponse.scriptContent)
    expect(result.seoTags).toEqual(fakeResponse.seoTags)
    expect(result.seoPinnedComment).toBe(fakeResponse.seoPinnedComment)
    expect(result.seoThumbnailPhrases).toHaveLength(2)
  })

  it('incluye la transcripción de referencia en el prompt cuando el estilo es personalizado', async () => {
    let capturedParams: unknown
    const client = {
      messages: {
        create: async (params: unknown) => {
          capturedParams = params
          return { content: [{ type: 'text', text: JSON.stringify(fakeResponse) }] }
        },
      },
    }

    await generateScript(client, {
      ...baseInput,
      style: 'personalizado',
      referenceTranscript: 'Transcripción de referencia de ejemplo.',
    })

    const serialized = JSON.stringify(capturedParams)
    expect(serialized).toContain('Transcripción de referencia de ejemplo.')
  })

  it('lanza un error descriptivo si Claude no devuelve JSON válido', async () => {
    const client = fakeAnthropicClient('no es json')

    await expect(generateScript(client, baseInput)).rejects.toThrow(/JSON/)
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test -- lib/scripts/generate-script.test.ts`
Expected: FAIL — no se puede importar `./generate-script`.

- [ ] **Step 3: Implementar**

`lib/scripts/generate-script.ts`:

```typescript
import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface GenerateScriptInput {
  topic: string
  channelNiche: string
  channelVariationRules: string
  targetLanguage: string
  targetCharacterCount: number
  style: 'estandar' | 'personalizado'
  referenceTranscript?: string
}

export interface GeneratedScript {
  scriptContent: string
  seoDescription: string
  seoTags: string[]
  seoPinnedComment: string
  seoThumbnailPhrases: string[]
  seoImagePrompt: string
}

export async function generateScript(
  client: AnthropicMessagesClient,
  input: GenerateScriptInput
): Promise<GeneratedScript> {
  const styleInstruction =
    input.style === 'personalizado' && input.referenceTranscript
      ? `Estilo personalizado: analiza el patrón estructural y narrativo (ritmo, tipo de apertura, forma de cerrar ideas) de esta transcripción de referencia y replica ESE PATRÓN — nunca copies su texto literal:\n\n"""${input.referenceTranscript}"""`
      : 'Estilo estándar: usa una estructura de hook (0-15s) + payoff cada 60-90s + CTA final.'

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system:
      'Eres un guionista para un canal de YouTube faceless. Escribes en el idioma indicado, respetando ' +
      'las reglas de variación del canal para evitar contenido templado sin variación creativa (riesgo de ' +
      'penalización por "Inauthentic Content"). Apunta al conteo de caracteres indicado — es mejor pasarte ' +
      'un poco que quedarte corto, prioriza siempre un cierre lógico del guion sobre cortar en seco al llegar ' +
      'al número exacto. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con el formato: ' +
      '{"scriptContent": string, "seoDescription": string, "seoTags": string[], "seoPinnedComment": string, ' +
      '"seoThumbnailPhrases": string[], "seoImagePrompt": string}',
    messages: [
      {
        role: 'user',
        content:
          `Tema: ${input.topic}\n` +
          `Nicho del canal: ${input.channelNiche}\n` +
          `Idioma de salida: ${input.targetLanguage}\n` +
          `Conteo de caracteres objetivo: ${input.targetCharacterCount}\n` +
          `Reglas de variación obligatoria: ${input.channelVariationRules}\n\n` +
          `${styleInstruction}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as GeneratedScript
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el guion: ${text.slice(0, 200)}`)
  }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm test -- lib/scripts/generate-script.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scripts/generate-script.ts lib/scripts/generate-script.test.ts
git commit -m "feat: add Claude-based script + SEO package generator"
```

---

### Task 5: UI de Guiones (lista, crear, detalle con división por bloques)

**Files:**
- Create: `app/(protected)/canales/[id]/guiones/page.tsx`
- Create: `app/(protected)/canales/[id]/guiones/nuevo/page.tsx`
- Create: `app/(protected)/canales/[id]/guiones/nuevo/actions.ts`
- Create: `app/(protected)/canales/[id]/guiones/[videoId]/page.tsx`
- Create: `app/(protected)/canales/[id]/guiones/[videoId]/actions.ts`

**Interfaces:**
- Consumes: `estimateTargetCharacterCount` (Task 2), `splitIntoCoherentBlocks` (Task 3), `generateScript` (Task 4), `createAnthropicClient` (existente), componentes de `components/ui/*` (existentes: Card, Button, Field/Input/Textarea/Select, Badge).

- [ ] **Step 1: Server action de generación**

`app/(protected)/canales/[id]/guiones/nuevo/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnthropicClient } from '@/lib/llm/anthropic-client'
import { estimateTargetCharacterCount } from '@/lib/scripts/duration-estimate'
import { generateScript } from '@/lib/scripts/generate-script'
import { redirect } from 'next/navigation'

export async function createVideo(
  channelId: string,
  input: {
    topic: string
    targetDurationSeconds: number
    style: 'estandar' | 'personalizado'
    referenceTranscript?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { videoId: null, error: 'No autenticado' }

  const { data: channel } = await supabase
    .from('channels')
    .select('niche, variation_rules, target_language, brand_voice_id')
    .eq('id', channelId)
    .single()
  if (!channel) return { videoId: null, error: 'Canal no encontrado' }

  const { data: calibration } = await supabase
    .from('voice_pace_calibration')
    .select('chars_per_minute')
    .eq('brand_voice_id', channel.brand_voice_id ?? 'default')
    .eq('target_language', channel.target_language)
    .maybeSingle()

  const { data: fallbackCalibration } = await supabase
    .from('voice_pace_calibration')
    .select('chars_per_minute')
    .eq('brand_voice_id', 'default')
    .eq('target_language', 'default')
    .single()

  const charsPerMinute = calibration?.chars_per_minute ?? fallbackCalibration!.chars_per_minute

  const targetCharacterCount = estimateTargetCharacterCount({
    targetDurationSeconds: input.targetDurationSeconds,
    charsPerMinute,
  })

  const { data: video, error: insertError } = await supabase
    .from('videos')
    .insert({
      channel_id: channelId,
      topic: input.topic,
      target_duration_seconds: input.targetDurationSeconds,
      target_character_count: targetCharacterCount,
      style: input.style,
      reference_transcript: input.referenceTranscript,
      status: 'generating',
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError || !video) return { videoId: null, error: insertError?.message ?? 'Error creando el video' }

  try {
    const anthropic = createAnthropicClient()
    const result = await generateScript(anthropic, {
      topic: input.topic,
      channelNiche: channel.niche,
      channelVariationRules: channel.variation_rules,
      targetLanguage: channel.target_language,
      targetCharacterCount,
      style: input.style,
      referenceTranscript: input.referenceTranscript,
    })

    await supabase
      .from('videos')
      .update({
        status: 'scripted',
        script_content: result.scriptContent,
        seo_description: result.seoDescription,
        seo_tags: result.seoTags,
        seo_pinned_comment: result.seoPinnedComment,
        seo_thumbnail_phrases: result.seoThumbnailPhrases,
        seo_image_prompt: result.seoImagePrompt,
      })
      .eq('id', video.id)
  } catch (err) {
    await supabase
      .from('videos')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Error desconocido' })
      .eq('id', video.id)
    return { videoId: video.id, error: err instanceof Error ? err.message : 'Error desconocido' }
  }

  redirect(`/canales/${channelId}/guiones/${video.id}`)
}
```

- [ ] **Step 2: Formulario de nuevo guion**

`app/(protected)/canales/[id]/guiones/nuevo/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createVideo } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { useParams } from 'next/navigation'

export default function NuevoGuionPage() {
  const params = useParams<{ id: string }>()
  const [style, setStyle] = useState<'estandar' | 'personalizado'>('estandar')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createVideo(params.id, {
      topic: formData.get('topic') as string,
      targetDurationSeconds: Number(formData.get('targetDurationMinutes')) * 60,
      style,
      referenceTranscript: (formData.get('referenceTranscript') as string) || undefined,
    })
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Nuevo guion</h1>
      <Card className="max-w-xl">
        <form action={handleSubmit}>
          <Field label="Tema del video">
            <Input name="topic" required />
          </Field>
          <Field label="Duración objetivo (minutos)">
            <Input name="targetDurationMinutes" type="number" step="0.5" defaultValue={8} required />
          </Field>
          <Field label="Estilo">
            <Select value={style} onChange={(e) => setStyle(e.target.value as 'estandar' | 'personalizado')}>
              <option value="estandar">Estándar</option>
              <option value="personalizado">Personalizado (replicar una transcripción de referencia)</option>
            </Select>
          </Field>
          {style === 'personalizado' && (
            <Field label="Transcripción de referencia">
              <Textarea name="referenceTranscript" required className="min-h-40" />
            </Field>
          )}
          {error && <p className="mb-4 text-sm font-medium text-accent-coral-ink" role="alert">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Generando...' : 'Generar guion'}</Button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Lista de guiones del canal**

`app/(protected)/canales/[id]/guiones/page.tsx`:

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default async function GuionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await params
  const supabase = await createClient()
  const { data: videos } = await supabase
    .from('videos')
    .select('id, topic, status, target_duration_seconds')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Guiones</h1>
        <Link href={`/canales/${channelId}/guiones/nuevo`}>
          <Button>+ Nuevo guion</Button>
        </Link>
      </div>
      <div className="grid gap-3">
        {videos?.map((v) => (
          <Link key={v.id} href={`/canales/${channelId}/guiones/${v.id}`}>
            <Card className="flex items-center justify-between hover:shadow-md">
              <div>
                <p className="font-semibold text-ink">{v.topic}</p>
                <p className="text-sm text-muted">{Math.round(v.target_duration_seconds / 60)} min objetivo</p>
              </div>
              <Badge tone={v.status === 'scripted' ? 'lime' : v.status === 'failed' ? 'coral' : 'sky'}>{v.status}</Badge>
            </Card>
          </Link>
        ))}
        {videos?.length === 0 && (
          <Card><p className="text-muted">Todavía no hay guiones para este canal.</p></Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Server action de división en bloques**

`app/(protected)/canales/[id]/guiones/[videoId]/actions.ts`:

```typescript
'use server'

import { splitIntoCoherentBlocks } from '@/lib/scripts/block-splitter'

export async function splitScript(scriptContent: string, targetBlockSize: number) {
  return splitIntoCoherentBlocks(scriptContent, targetBlockSize)
}
```

- [ ] **Step 5: Página de detalle del guion**

`app/(protected)/canales/[id]/guiones/[videoId]/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { splitScript } from './actions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'

interface VideoRow {
  topic: string
  status: string
  error_message: string | null
  script_content: string | null
  seo_description: string | null
  seo_tags: string[] | null
  seo_pinned_comment: string | null
  seo_thumbnail_phrases: string[] | null
  seo_image_prompt: string | null
}

export default function GuionDetallePage() {
  const params = useParams<{ videoId: string }>()
  const [video, setVideo] = useState<VideoRow | null>(null)
  const [blockSize, setBlockSize] = useState(3000)
  const [blocks, setBlocks] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('videos')
      .select('*')
      .eq('id', params.videoId)
      .single()
      .then(({ data }) => setVideo(data))
  }, [params.videoId])

  async function handleSplit() {
    if (!video?.script_content) return
    setBlocks(await splitScript(video.script_content, blockSize))
  }

  if (!video) return <p className="text-muted">Cargando...</p>

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{video.topic}</h1>
        <Badge tone={video.status === 'scripted' ? 'lime' : video.status === 'failed' ? 'coral' : 'sky'}>{video.status}</Badge>
      </div>

      {video.error_message && (
        <Card className="mb-4"><p className="text-sm font-medium text-accent-coral-ink" role="alert">{video.error_message}</p></Card>
      )}

      {video.script_content && (
        <div className="grid gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Guion</h2>
            <p className="whitespace-pre-wrap text-sm text-ink">{video.script_content}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">SEO</h2>
            <p className="mb-2 text-sm text-ink">{video.seo_description}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {video.seo_tags?.map((t) => <Badge key={t} tone="sky">{t}</Badge>)}
            </div>
            <p className="mb-2 text-sm text-ink"><strong>Comentario fijado:</strong> {video.seo_pinned_comment}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {video.seo_thumbnail_phrases?.map((p) => <Badge key={p} tone="coral">{p}</Badge>)}
            </div>
            <p className="text-sm text-muted"><strong>Prompt de imagen:</strong> {video.seo_image_prompt}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-muted">Dividir para locución</h2>
            <div className="mb-4 flex items-end gap-3">
              <Field label="Tamaño de bloque (caracteres)">
                <Input type="number" value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))} />
              </Field>
              <Button variant="secondary" onClick={handleSplit}>Dividir</Button>
            </div>
            {blocks.length > 0 && (
              <ol className="flex flex-col gap-2">
                {blocks.map((b, i) => (
                  <li key={i} className="rounded-control bg-canvas p-3 text-sm text-ink">
                    <span className="mb-1 block text-xs font-semibold text-muted">Bloque {i + 1} ({b.length} caracteres)</span>
                    {b}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Enlace desde la página de edición de canal**

Agregar el ícono `IconFileText` a `components/ui/icons.tsx` (junto a los demás):

```typescript
export function IconFileText(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}
```

En `app/(protected)/canales/[id]/page.tsx`, cambiar el import de iconos y agregar un tercer botón:

```typescript
import { IconCopy, IconHash, IconFileText } from '@/components/ui/icons'
```

```typescript
          <Link href={`/canales/${id}/guiones`}>
            <Button variant="secondary" className="gap-2">
              <IconFileText width={16} height={16} /> Guiones
            </Button>
          </Link>
          <Link href={`/canales/${id}/clonar`}>
            <Button variant="secondary" className="gap-2">
              <IconCopy width={16} height={16} /> Clonar canal
            </Button>
          </Link>
          <Link href={`/canales/${id}/keywords`}>
            <Button variant="secondary" className="gap-2">
              <IconHash width={16} height={16} /> Keywords y títulos
            </Button>
          </Link>
```

(reemplaza el bloque de dos `Link` existentes por estos tres, en ese orden).

- [ ] **Step 7: Lint y build**

```bash
npm run lint
npm run build
```

Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add "app/(protected)/canales/[id]/guiones" "app/(protected)/canales/[id]/page.tsx"
git commit -m "feat: add Guiones (script factory) pages"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Suite completa de tests**

Run: `npm test`
Expected: todos los tests pasan contra el proyecto real, sin dejar datos de prueba (usar `deleteTestUser` como en los planes anteriores — ya incluye limpieza de `channels`; si algún test de este plan crea `videos` directamente habría que sumarlo a `deleteTestUser`, pero los tests de este plan solo crean canales vía el helper existente, no videos sueltos fuera de eso).

- [ ] **Step 2: Lint y build**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Advisors de seguridad**

```bash
npx supabase db advisors --linked --type security
```

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: final verification pass for Script Factory"
```
