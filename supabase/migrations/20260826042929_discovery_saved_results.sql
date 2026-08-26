alter table public.discovery_results add column saved boolean not null default false;

create policy "discovery_results_update_admin_investigador"
  on public.discovery_results for update to authenticated
  using (private.get_my_role() in ('admin', 'investigador'))
  with check (private.get_my_role() in ('admin', 'investigador'));
