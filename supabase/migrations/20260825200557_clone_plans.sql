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
