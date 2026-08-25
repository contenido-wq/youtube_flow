# Fábrica de Canales de YouTube Faceless con IA — Spec de Diseño

**Fecha:** 2026-08-25
**Estado:** Aprobado para pasar a plan de implementación (Fase 1)
**Alcance de este documento:** arquitectura completa de la plataforma + spec detallado de la Fase 1 (Project Hub + Discovery Engine). Los módulos de Fases 2+ se documentan a nivel de roadmap; cada uno tendrá su propio ciclo spec → plan → build cuando le toque.

---

## 1. Visión general

Plataforma interna de equipo para operar una "fábrica" de canales de YouTube faceless generados con IA: desde la investigación de nichos/canales ganadores hasta la entrega de assets numerados (guion, audio, tomas de video, miniatura, metadatos) a un sistema externo de edición automática ya existente (fuera del alcance de este documento).

**Usuarios:** equipo interno, multi-usuario con roles (investigador de nicho, guionista, editor de video, aprobador).

**Objetivo de negocio:** reducir el tiempo de producción por video (hoy ~3-4h manuales según referencias de la industria) mediante un pipeline asistido por IA con checkpoints humanos en los puntos que importan, sin caer en producción masiva sin variación (riesgo real de suspensión de canal — ver sección 8).

---

## 2. Arquitectura general

**Stack:** Next.js + TypeScript (frontend + API routes) sobre Supabase (Auth con roles, Postgres, Storage, Realtime, Edge Functions).

**Patrón para integraciones externas (todas asíncronas y potencialmente lentas/costosas):** una tabla `jobs` en Postgres + Edge Functions que disparan la llamada externa + webhooks/polling para actualizar el estado. Mismo patrón para las 4 categorías de integración externa: generación de voz, generación de imagen, generación de video, y scraping/discovery.

```
                    ┌─────────────────────────────────────┐
                    │   Next.js + Supabase (Auth/roles)    │
                    │        Project Hub (UI equipo)       │
                    └───────────────┬───────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   ┌────▼─────┐   ┌─────▼──────┐  ┌─────▼──────┐  ┌────────▼────────┐
   │Discovery │   │  Script    │  │  Voice     │  │  Visual Factory │
   │ Engine   │──▶│  Factory   │─▶│  Factory   │─▶│ (Veo/Nano Banana│
   │(canales, │   │(guion+     │  │(Kokoro/    │  │ /Higgsfield)    │
   │ keywords,│   │ título)    │  │ ElevenLabs)│  │ + numeración    │
   │ títulos, │   └────────────┘  └────────────┘  └─────────────────┘
   │ clonación)                                            │
   └──────────┘                                            ▼
                                            ┌───────────────────────────┐
                                            │  Export / Handoff a tu    │
                                            │  editor automático        │
                                            │  (fuera de este scope)    │
                                            └───────────────────────────┘
```

**Fase 1 de construcción = Project Hub + Discovery Engine** (recuadros marcados arriba). El resto de módulos (Script/Voice/Visual/Thumbnail Factory, Export) quedan en el roadmap de la sección 10, con su tool-mapping ya decidido pero su implementación en fases posteriores.

---

## 3. Flujo completo de producción de un video (referencia para todo el pipeline)

### Fase 0 — Configurar el canal (una sola vez, antes del primer video)

Cada canal tiene un "perfil/ADN" que se inyecta automáticamente en cada generación posterior, para mantener consistencia de marca y controlar el riesgo de "Inauthentic Content" (sección 8):

- Nicho y país/idioma objetivo
- Voz de marca (qué voz de Kokoro/ElevenLabs se usa siempre)
- Estilo visual de referencia (prompt/imagen reutilizada en cada generación de Veo/Nano Banana)
- Plantilla de miniatura (colores, tipografía, layout base)
- Reglas de variación obligatoria (qué debe cambiar sí o sí de video a video)

### Fase 1 — Producir un video

1. **Elegir el tema**: vía scouting parametrizado en el Discovery Engine, o vía **Clonar Canal** (sección 6).
2. **Keywords + títulos**: research de keywords sobre el tema elegido → 5-10 títulos estratégicos generados → el equipo elige.
3. **Guion**: generado en el idioma objetivo, estructurado en beats (hook 0-15s, payoff cada 60-90s, CTA), inyectando el perfil del canal. **Checkpoint humano obligatorio.**
4. **Audio**: guion aprobado → TTS (Kokoro para borrador/volumen, ElevenLabs para voz de marca clonada) → audio + transcripción con timestamps.
5. **Plan de tomas (shot list)**: el guion se descompone en escenas individuales con duración (ajustada a los timestamps del audio), prompt visual (texto de esa parte + estilo de referencia del canal), y número de secuencia (`scene_001`, `scene_002`...).
6. **Generación visual**: cada toma → Veo/Higgsfield (clip) o Nano Banana Pro (imagen fija), usando el prompt + referencia de estilo del canal. **Checkpoint humano por toma** (regenerar solo la que falló, no el video completo — control de calidad y de costo).
7. **Miniatura**: 2-3 opciones generadas en paralelo vía Nano Banana Pro/Ideogram usando la plantilla del canal + título elegido.
8. **Metadatos**: descripción, tags, categoría — generados por prompt usando guion + keywords.
9. **Empaquetado y entrega**: clips numerados + audio + miniatura + metadatos, con manifiesto JSON, entregado al sistema de edición externo (contrato genérico y adaptable — ver sección 9).

---

## 4. Modelo de datos (entidades núcleo)

- **`channels`** — perfil/ADN del canal (nicho, idioma, voz de marca, referencia visual, plantilla de miniatura, reglas de variación)
- **`discovery_runs` / `discovery_results`** — cada búsqueda de scouting con sus filtros parametrizados y los canales/videos encontrados (independiente de los canales propios — es investigación de mercado)
- **`channel_clone_plans` / `clone_plan_items`** — plan de clonación generado a partir de un canal fuente: catálogo analizado, outliers identificados, temas propuestos y su estado (pendiente/adaptado/cargado a producción)
- **`videos`** — proyecto de video, pertenece a un `channel`, `status` de pipeline (`scouted → scripted → voiced → shot_planned → visualized → thumbnailed → exported`), referencias a tema/keywords/título elegidos
- **`shots`** — tomas individuales de un video (número de secuencia, duración objetivo, prompt visual, estado: pendiente/generado/aprobado/rechazado)
- **`assets`** — archivos generados (audio, clips, miniaturas), tipo, versión (para regeneraciones), costo asociado
- **`jobs`** — cola de trabajos async hacia APIs externas (Veo, Nano Banana, ElevenLabs/Kokoro, AssemblyAI, motor de scraping), estado y reintentos
- **`team_members` / `roles`** — permisos por rol (investigador, guionista, editor de video, aprobador)

---

## 5. Discovery Engine — spec detallado (Fase 1)

### 5.1 Scouting parametrizado

Filtros configurables por el usuario (no hardcodeados):

- Edad del canal (ej. creado hace &lt;3 meses)
- Suscriptores (ej. &lt;100k)
- Vistas por video (ej. &gt;1,000)
- Velocidad de subida, mezcla Shorts/long-form, nicho/categoría, geografía

**Importante (hallazgo de investigación):** YouTube subió el umbral de monetización en agosto 2026 a **1,000 subs + 8,000 horas de watch time (12 meses) O 20M vistas en Shorts (90 días)**. Suscriptores por sí solo es una señal débil de monetización real — el filtro debe modelar una **puntuación compuesta** (edad del canal + velocidad de subida + vistas promedio + mezcla Shorts/long-form) en vez de un único umbral de subs.

### 5.2 Motor de datos — arquitectura de adaptador intercambiable

Tres motores posibles, todos detrás de la misma interfaz interna (para poder cambiar de motor sin rediseñar el módulo):

1. **Self-hosted (recomendado como motor principal)**: servicio propio en Docker basado en **NewPipe Extractor / Piped**, sin necesidad de API key. Costo: solo infraestructura. Motor de descubrimiento masivo.
2. **YouTube Data API v3 (oficial, gratis con cuota)**: usado como **verificación barata** de candidatos ya filtrados (`channels.list` = 1 unidad/llamada) y para extracción eficiente de catálogo completo de un canal vía el *uploads playlist trick* (`channels.list` → `contentDetails.relatedPlaylists.uploads` → `playlistItems.list`, 1 unidad/llamada, evita el costoso `search.list` de 100 unidades).
3. **Apify (o actor similar)**: opción de respaldo/alternativa cuando se prefiera no mantener infraestructura propia — actors tipo YouTube Channel/Video Scraper. Ya integrado y probado en el ecosistema del equipo (AIVI).

**Riesgo/ToS:** scraping de metadatos (títulos, vistas, fechas) a volumen moderado y programado (batches diarios/semanales, no tiempo real) es de bajo riesgo — distinto de la descarga masiva de video completo, que es lo que ha generado acción legal contra herramientas similares. Mitigar con: volumen moderado, sin IP rotation agresiva, motor self-hosted como capa de abstracción mantenida en vez de scraping crudo.

### 5.3 Keywords y títulos

- Keywords Everywhere API como fuente de datos de volumen de búsqueda.
- Generación de títulos estratégicos vía prompt propio (Claude/Gemini API) sobre esos datos de keywords — no existe una herramienta de título dedicada que valga la pena comprar; es una tarea de prompting, no de compra de producto.

### 5.4 Clonar Canal

1. **Input**: canal elegido de los resultados de scouting, o URL/ID pegada directamente.
2. **Extracción de catálogo completo**: vía el *uploads playlist trick* del API oficial (barato) o vía el motor self-hosted.
3. **Análisis de patrón**: pilares temáticos recurrentes, fórmulas de título, cadencia de publicación, duración promedio, y **outliers de desempeño dentro del propio canal** (videos que superaron significativamente su propio promedio — son los que vale la pena modelar).
4. **Output**: plan de clonación — lista de temas/formatos propuestos, mapeados a los videos de mejor desempeño del canal fuente pero adaptados (traducidos, reestructurados), cargable directo como cola de videos pendientes del canal nuevo.
5. **Control de riesgo obligatorio**: nunca se clona guion literal. Cada tema clonado pasa por las reglas de variación del perfil del canal (Fase 0, sección 3) antes de llegar a generación de guion — clonar estrategia está permitido y es práctica estándar del nicho; clonar contenido literal es lo que causó la ola de suspensiones de enero 2026 (~16 canales, 35M subs combinados, bajo la política "Inauthentic Content").

---

## 6. Manejo de errores y control de calidad (aplica a todo el pipeline, no solo Fase 1)

- Cada paso del pipeline (guion, audio, cada toma, miniatura) tiene su propio checkpoint independiente — se puede regenerar un paso puntual sin rehacer el video completo.
- Antes de disparar generación de video (la integración más cara, $0.12–0.75/seg según proveedor), el sistema muestra una estimación de costo del shot list completo para aprobación explícita del equipo.
- Los `jobs` fallidos se reintentan con backoff; fallos persistentes se marcan para revisión manual, no se reintenta indefinidamente.

---

## 7. Testing y validación

- Tests unitarios sobre la lógica de scoring/filtrado del Discovery Engine (composición de señales de monetización, detección de outliers en Clonar Canal) — es lógica determinística y testeable sin mockear las APIs externas.
- Tests de integración con mocks para los 3 motores de datos (self-hosted, YouTube API, Apify) verificando que la interfaz de adaptador intercambiable realmente aísla al resto del sistema del motor específico.
- Validación manual (no automatizable) de ai33.pro y scripzy.app antes de integrarlos: un miembro del equipo debe crear cuenta y confirmar precio real + disponibilidad de API — la investigación de mercado no pudo verificar esto (sitios bloquean scraping/piden login).

---

## 8. Riesgos y controles de política de YouTube

- **Política "Inauthentic Content"** (renombrada 2025-07-15): penaliza contenido masivo/templado sin variación creativa, no el uso de IA en sí. La ola de enforcement de enero 2026 confirma que esto es un riesgo real y activo, no teórico.
- **Control arquitectónico, no opcional**: las reglas de variación del perfil de canal (Fase 0) y el control de "nunca clonar guion literal" (sección 5.4) son requisitos de diseño de primera clase, no features opcionales a futuro.
- **Guardrail de costo**: estimación de costo pre-aprobada antes de generación de video, para evitar sorpresas de facturación a escala de "fábrica".

---

## 9. Contrato de exportación (adaptable)

Formato genérico por defecto, diseñado para poder adaptarse sin rediseño cuando se conecte con el sistema de edición automática existente (fuera de alcance de este documento):

- Carpeta por video con los clips/tomas numerados secuencialmente (`scene_001.mp4`, `scene_002.mp4`, ...)
- Audio como archivo independiente con su transcripción con timestamps
- Miniatura(s) seleccionada(s)
- Manifiesto JSON con metadatos (título, descripción, tags, categoría, referencias a cada asset y su versión)

---

## 10. Roadmap de módulos futuros (fuera del alcance de implementación de este spec)

Tool-mapping ya decidido para cuando les toque su propio ciclo spec → plan → build:

| Módulo | Opción principal | Alternativa barata/nicho |
|---|---|---|
| Script Factory | Claude/Gemini API directo con prompt propio (estructura de beats) | scripzy.app (validar manualmente) |
| Voice Factory | Kokoro (gratis, self-hosted) para borrador/volumen | ElevenLabs (voz de marca/clonada); ai33.pro (validar manualmente) |
| Visual Factory | Veo 3.1 (video) + Nano Banana Pro (imagen) vía Gemini/Vertex API — misma cuenta Google para ambos | Higgsfield (ya conectado en el entorno de trabajo); Kling/Runway/Luma como respaldo |
| Thumbnail Factory | Nano Banana Pro API | Ideogram/Recraft para overlays de texto |
| Subtítulos | AssemblyAI ($0.0025/min) | Deepgram |
| Música/SFX | Mubert API (generativo) | Zapsplat (gratis, sin API) |
| Export/Handoff | Contrato genérico definido en sección 9 | — |

---

## 11. Fuera de alcance

- El sistema de edición automática existente del equipo — solo se define el contrato de entrada (sección 9), no su funcionamiento interno.
- Publicación/programación automática en YouTube y analítica post-publicación de los canales propios — no mencionado como requisito, puede evaluarse como módulo futuro si se necesita.
