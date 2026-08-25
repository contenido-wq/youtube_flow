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
