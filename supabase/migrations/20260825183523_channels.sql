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
