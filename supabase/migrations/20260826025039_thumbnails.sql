alter table public.videos add column thumbnail_urls text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Las miniaturas son de lectura pública (se usan como imagen de video en
-- YouTube, no hay nada sensible que proteger), pero solo admin/investigador
-- pueden subir/reemplazar/borrar — mismo patrón de permisos que el resto
-- del pipeline de producción.
create policy "thumbnails_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'thumbnails');

create policy "thumbnails_insert_admin_investigador"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'thumbnails' and private.get_my_role() in ('admin', 'investigador'));

create policy "thumbnails_update_admin_investigador"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'thumbnails' and private.get_my_role() in ('admin', 'investigador'))
  with check (bucket_id = 'thumbnails' and private.get_my_role() in ('admin', 'investigador'));

create policy "thumbnails_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'thumbnails' and private.get_my_role() = 'admin');
