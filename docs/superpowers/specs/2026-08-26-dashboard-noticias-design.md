# Sección de Noticias en el Dashboard — Spec de Diseño

**Fecha:** 2026-08-26
**Estado:** Aprobado para pasar a plan de implementación
**Alcance de este documento:** una sección nueva en `/dashboard` que muestra un digest editorial (tipo blog) sobre lo que está pasando en YouTube, generado automáticamente a partir de fuentes crudas + síntesis con Claude. No introduce infraestructura de cron/Edge Functions nueva; sigue el patrón "on-demand disparado por acción del usuario" que ya usa el módulo Discovery.

---

## 1. Objetivo

Darle al equipo, sin que nadie tenga que ir a buscarlo, un resumen periódico de:

1. **Oficial YouTube** — anuncios/cambios de la plataforma.
2. **Competencia** — qué están haciendo canales establecidos en los nichos que ya trabajan.
3. **Canales nuevos** — canales jóvenes/creciendo rápido en esos mismos nichos, dignos de vigilar.
4. **Recomendaciones** — síntesis editorial: tipos de canal, temáticas, tipos de personaje/formato que están funcionando, y qué implica una actualización de YouTube para el equipo.

No es un feed de datos crudos — es contenido legible, con análisis y recomendación, como pidió el usuario ("como si fuera un blog mostrando análisis y dando recomendaciones").

## 2. Fuentes crudas (sin entrada manual)

**a) Oficial YouTube**
Lista fija de canales oficiales monitoreados vía YouTube Data API (`playlistItems.list` sobre su uploads playlist, igual que ya hace `youtube-api-engine.ts`):

- Creator Insider
- YouTube Creators
- TeamYouTube

Se leen títulos + descripciones de sus uploads de los últimos 7 días.

**b) Competencia + canales nuevos**
Se reutiliza `YouTubeApiDiscoveryEngine.searchChannels` (mismo motor que usa `/descubrimiento`) corriendo una búsqueda automática por cada `niche` distinto presente en la tabla `channels`, acotado a **máximo 3 nichos por run** (para no disparar cuota de YouTube). Los resultados ya traen `channelAgeDays`, `subscriberCount`, `monetizationScore`, etc. — se clasifican sin lógica nueva:

- **Competencia**: canales con `subscriberCount` alto y `channelAgeDays` alto (establecidos).
- **Canales nuevos**: canales con `channelAgeDays` bajo y `uploadVelocityPerWeek`/`monetizationScore` altos (creciendo rápido).

## 3. Síntesis editorial con Claude

Las señales crudas de (a) y (b) se pasan como contexto a un único prompt sobre `lib/llm/anthropic-client.ts` (mismo cliente que ya usan guiones/clonación), pidiendo un JSON validado con Zod: una lista de ítems, cada uno con `category`, `title`, `summary` (2-3 líneas, tono análisis+recomendación), y opcionalmente `source_url`/`source_channel_youtube_id`.

Response shape (Zod):

```ts
const NewsItemSchema = z.object({
  category: z.enum(['oficial', 'competencia', 'canales_nuevos', 'recomendacion']),
  title: z.string(),
  summary: z.string(),
  source_url: z.string().url().nullable(),
  source_channel_youtube_id: z.string().nullable(),
})
const DigestResponseSchema = z.object({ items: z.array(NewsItemSchema) })
```

Si el parseo/validación falla, el run se marca `failed` (ver §6).

## 4. Modelo de datos

```sql
create type public.news_category as enum ('oficial', 'competencia', 'canales_nuevos', 'recomendacion');

create table public.news_digest_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.team_members(id),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  digest_run_id uuid not null references public.news_digest_runs(id) on delete cascade,
  category public.news_category not null,
  title text not null,
  summary text not null,
  source_url text,
  source_channel_youtube_id text,
  created_at timestamptz not null default now()
);

alter table public.news_digest_runs enable row level security;
alter table public.news_items enable row level security;

grant select, insert, update, delete on public.news_digest_runs to authenticated;
grant select, insert, update, delete on public.news_items to authenticated;

create policy "news_digest_runs_select_all_authenticated"
  on public.news_digest_runs for select to authenticated using (true);

create policy "news_digest_runs_insert_all_authenticated"
  on public.news_digest_runs for insert to authenticated with check (true);

create policy "news_digest_runs_update_all_authenticated"
  on public.news_digest_runs for update to authenticated using (true) with check (true);

create policy "news_items_select_all_authenticated"
  on public.news_items for select to authenticated using (true);

create policy "news_items_insert_all_authenticated"
  on public.news_items for insert to authenticated with check (true);
```

A diferencia de `discovery_runs` (insert restringido a `admin`/`investigador`), aquí **cualquier rol autenticado puede insertar/actualizar**: la generación la dispara automáticamente quien sea que visite el dashboard, y el contenido es de sistema, no un recurso que alguien "posee". No hay `delete` policy porque nadie borra digests desde la UI.

## 5. Pipeline (`lib/news/`)

Paralelo a `lib/discovery/`:

- `official-sources.ts` — constante con los 3 canales oficiales (id + nombre).
- `fetch-official-updates.ts` — trae uploads recientes de esos canales vía YouTube Data API.
- `fetch-niche-signals.ts` — corre `YouTubeApiDiscoveryEngine.searchChannels` por hasta 3 nichos distintos de `channels`, clasifica en competencia/nuevos.
- `generate-digest.ts` — arma el prompt, llama a Claude, valida con Zod.
- `ensure-fresh-digest.ts` — orquestador: chequea el último run completado; si tiene más de 24h o no existe, corre el pipeline completo (inserta run `running` → corre → inserta `news_items` → marca `completed`/`failed`).
- `types.ts` — tipos compartidos.

## 6. Disparo automático y manejo de fallos

`ensure-fresh-digest.ts` se llama desde `app/(protected)/dashboard/page.tsx` antes de renderizar (mismo lugar donde ya hace las queries en paralelo con `Promise.all`):

1. Busca el último `news_digest_runs` con `status = 'completed'`.
2. Si tiene **menos de 24h**, usa sus `news_items` tal cual — no genera nada.
3. Si tiene **más de 24h o no existe**:
   - Chequea que no haya un run `running` creado hace menos de 5 minutos (evita carreras si dos personas abren el dashboard casi a la vez); si lo hay, usa el último digest completado disponible (o estado vacío) sin generar otro.
   - Si no hay carrera en curso, inserta un run `running` y ejecuta el pipeline **inline, awaited** (bloquea esa carga de página unos segundos — aceptado, pasa como máximo una vez cada 24h).
   - Si el pipeline falla (cuota de YouTube, error de Claude, red), marca el run `failed` con `error_message` y el dashboard cae de vuelta al último digest `completed` disponible.
   - Si nunca hubo un digest exitoso, el dashboard muestra un estado vacío ("Todavía no hay noticias generadas") sin romper el resto de la página.

## 7. UI

Nueva sección "Noticias" en `app/(protected)/dashboard/page.tsx`, debajo de las stat cards y antes o después de "Tus canales" (se decide en implementación según cómo quede visualmente). Cuatro subsecciones apiladas, en este orden: **Oficial YouTube → Competencia → Canales nuevos → Recomendaciones**.

Cada subsección:
- Encabezado (`h2`, mismo estilo que "Tus canales").
- Lista de `Card` (componente existente) por ítem: `Badge` de color distinto por categoría, `title` en negrita, `summary` debajo, y si `source_url` existe, un link externo.
- Si una categoría no tiene ítems en el digest actual, la subsección no se muestra (sin estados vacíos por categoría individual).

Sin interactividad cliente para el MVP (todo server-rendered, sin tabs ni botón de refresco manual — confirmado con el usuario).

## 8. Fuera de alcance (MVP)

- Botón de refresco manual.
- Historial de digests pasados en la UI (solo se muestra el último `completed`).
- Marcar ítems como leídos/descartados.
- Competidores agregados manualmente por el usuario (se descartó explícitamente a favor de 100% automático por nicho).
