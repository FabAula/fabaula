-- =====================================================================
-- FabAula · 06 · Emmagatzematge de fotos i documents
-- Ruta dels fitxers: <school_id>/<taula>/<uuid>.<ext>
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media'
         and public.can_read(public.try_uuid((storage.foldername(name))[1])));

create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and public.is_member(public.try_uuid((storage.foldername(name))[1])));

create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media'
         and public.has_role(public.try_uuid((storage.foldername(name))[1]), '{admin,gestor}'));
