-- No hay filas existentes en public.videos todavía, así que se reestructura
-- directamente en vez de migrar datos: se agregan los títulos alternativos
-- y se reemplaza el prompt único de miniatura por 4 variaciones.
alter table public.videos add column seo_titles text[];
alter table public.videos drop column seo_image_prompt;
alter table public.videos add column seo_image_prompts text[];
