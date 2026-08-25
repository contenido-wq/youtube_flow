# Análisis de brecha: Scripsy.app vs. spec actual

**Fecha:** 2026-08-25
**Fuente:** guía de funcionalidades de Scripsy.app (también "Scrpzy.app") pegada por el usuario en conversación.
**Propósito:** revisar qué de esto ya está cubierto en el spec de la Fábrica de Canales, qué es nuevo y vale adoptar, y qué se descarta a propósito por no aplicar a un tool interno de equipo (vs. el SaaS multi-tenant que es Scripsy).

---

## Ya cubierto (spec existente, en algunos casos más avanzado)

| Funcionalidad de Scripsy | Dónde ya está en nuestro spec |
|---|---|
| Duración → conteo de caracteres | Sección 6.1 — igual concepto, pero calibrado empíricamente por voz+idioma en vez de una tabla fija |
| Heurística "entrega un poco más, nunca menos" | Sección 6.2 (margen de sobra configurable) |
| SEO generado junto al guion (descripción, tags) | Sección 6.3 |
| Presets de clonación de canal (URL de canal → patrón → nuevo contenido) | Sección 5.4 (Clonar Canal) — el nuestro además detecta outliers estadísticamente (mediana × multiplicador) en vez de solo "patrones generales", y ya está construido con motor real (YouTube Data API + Claude) |
| Multi-idioma | `channels.target_language` en el modelo de datos, sección 4 |
| Control de variación para no clonar literal | Sección 8 (riesgo de política) — más estricto que Scripsy, que no menciona este control |

## Nuevo — adoptado (agregado al spec, sección 6.3/6.4/6.5)

| Funcionalidad de Scripsy | Por qué se adopta | Dónde quedó |
|---|---|---|
| Comentario fijado | Insumo de SEO barato de generar (mismo prompt) con valor real de engagement | Sección 6.3 |
| Frases para miniatura + prompt de imagen | Alimenta directamente el futuro Thumbnail Factory (Nano Banana Pro/Ideogram) — generar esto ahora no cuesta nada extra en la misma llamada | Sección 6.3 |
| Estilo "Personalizado" (pegar una transcripción de referencia puntual) | Es un control más fino que Clonar Canal — a veces se quiere imitar UN video, no la estrategia completa de un canal | Sección 6.4 |
| División coherente por bloques ("coherence-first") | Utilidad genuinamente necesaria para el futuro Voice Factory (los proveedores de TTS tienen límites de longitud por llamada) | Sección 6.5 |

## Descartado a propósito (no aplica a un tool interno)

| Funcionalidad de Scripsy | Por qué no aplica aquí |
|---|---|
| Sistema de créditos/facturación por plan | Scripsy es un SaaS multi-tenant que cobra por uso; nosotros somos un equipo usando su propia cuenta de Claude/APIs — el control de costo ya está cubierto por el guardrail de presupuesto (spec sección 9), no necesitamos un sistema de créditos |
| Historial con límite de 50 guiones y borrado automático a las 2 semanas | Ese límite existe para controlar costos de almacenamiento de Scripsy sobre miles de usuarios externos. Nuestros guiones son el archivo de producción de la fábrica — se quieren conservar indefinidamente, atados al registro de `videos` cuando ese módulo se construya, no purgados |
| Cola de generación con límite de concurrencia por plan (ej. 3 simultáneos en plan Ultra) | Es un límite comercial de Scripsy, no técnico. Nuestra cola de `jobs` (spec sección 2) puede tener su propio límite de concurrencia si el costo lo amerita, pero no está atado a "planes" |
| Registro con Google/email, programa beta de "primeros 100 usuarios", Voice Lab como próximo lanzamiento | Es funnel de adquisición de un producto que se vende — no aplica a un tool interno con cuentas creadas por un admin (spec Fase 1, Project Hub) |
| Tooltips explicativos en cada campo | Nicety de UX genérico, no específico del dominio — se puede agregar después si el equipo lo pide, no es un requisito funcional |
| Campo "Label" para identificar guiones en local storage | Nuestro sistema persiste todo en Supabase con relaciones reales (`channel_id`, `video_id`) — no necesitamos una etiqueta de local storage para identificar guiones |

## Conclusión

De las 9 secciones de la guía de Scripsy, 4 elementos concretos valían la pena adoptar (comentario fijado, frases de miniatura + prompt de imagen, estilo personalizado por transcripción, segmentación coherente por bloques) y ya están incorporados al spec (sección 6). El resto son mecánicas de negocio SaaS (créditos, límites por plan, ciclo de vida de almacenamiento por costos, funnel de registro) que no tienen equivalente útil en una herramienta interna de equipo con su propia infraestructura.
