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
