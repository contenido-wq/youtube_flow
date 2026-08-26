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
