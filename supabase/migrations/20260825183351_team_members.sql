create schema if not exists private;

create type public.team_role as enum ('admin', 'investigador', 'guionista', 'editor', 'aprobador');

create table public.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.team_role not null default 'investigador',
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;

create or replace function private.get_my_role()
returns public.team_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.team_members where id = auth.uid();
$$;

create policy "team_members_select_all_authenticated"
  on public.team_members for select
  to authenticated
  using (true);

create policy "team_members_admin_insert"
  on public.team_members for insert
  to authenticated
  with check (private.get_my_role() = 'admin');

create policy "team_members_admin_update"
  on public.team_members for update
  to authenticated
  using (private.get_my_role() = 'admin')
  with check (private.get_my_role() = 'admin');

create policy "team_members_admin_delete"
  on public.team_members for delete
  to authenticated
  using (private.get_my_role() = 'admin');
