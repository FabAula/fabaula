-- =====================================================================
-- FabAula · 04 · Seguretat (Row Level Security)
--
-- Rols per centre:
--   admin   → tot, + gestiona membres, mòduls i llistes
--   gestor  → crea, edita i esborra a tots els mòduls (equip motor / directiu)
--   docent  → llegeix tot; registra usos, incidències, préstecs, consum,
--             sessions i projectes; pot editar el que ha creat ell mateix
-- Centre de demo → qualsevol usuari autenticat el pot llegir, ningú no hi escriu.
-- Admin de plataforma → crea centres i en gestiona membres i mòduls,
--   però no veu les dades del centre si no n'és membre.
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Taules del nucli
-- ---------------------------------------------------------------------
alter table public.schools          enable row level security;
alter table public.platform_admins  enable row level security;
alter table public.modules          enable row level security;
alter table public.school_modules   enable row level security;
alter table public.school_members   enable row level security;
alter table public.list_defs        enable row level security;
alter table public.list_defaults    enable row level security;
alter table public.list_items       enable row level security;

create policy schools_select on public.schools for select to authenticated
  using (public.is_member(id) or is_demo or public.is_platform_admin());
create policy schools_insert on public.schools for insert to authenticated
  with check (public.is_platform_admin());
create policy schools_update on public.schools for update to authenticated
  using (public.has_role(id, '{admin}') or public.is_platform_admin())
  with check (public.has_role(id, '{admin}') or public.is_platform_admin());
create policy schools_delete on public.schools for delete to authenticated
  using (public.is_platform_admin());

create policy platform_admins_self on public.platform_admins for select to authenticated
  using (email = public.current_email());

create policy modules_read on public.modules for select to authenticated using (true);
create policy list_defs_read on public.list_defs for select to authenticated using (true);
create policy list_defaults_read on public.list_defaults for select to authenticated using (true);

create policy school_modules_select on public.school_modules for select to authenticated
  using (public.can_read(school_id) or public.is_platform_admin());
create policy school_modules_write on public.school_modules for all to authenticated
  using (public.has_role(school_id, '{admin}') or public.is_platform_admin())
  with check (public.has_role(school_id, '{admin}') or public.is_platform_admin());

create policy members_select on public.school_members for select to authenticated
  using (public.can_read(school_id) or public.is_platform_admin());
create policy members_write on public.school_members for all to authenticated
  using (public.has_role(school_id, '{admin}') or public.is_platform_admin())
  with check (public.has_role(school_id, '{admin}') or public.is_platform_admin());

create policy list_items_select on public.list_items for select to authenticated
  using (public.can_read(school_id));
create policy list_items_write on public.list_items for all to authenticated
  using (public.has_role(school_id, '{admin}'))
  with check (public.has_role(school_id, '{admin}'));

-- ---------------------------------------------------------------------
-- Taules de domini: polítiques estàndard generades
-- ---------------------------------------------------------------------
create or replace function public._apply_domain_policies(
  p_table text, p_module text, p_docent_insert boolean, p_docent_update_own boolean)
returns void language plpgsql
as $$
declare
  v_staff  text := format('public.has_role(school_id, ''{admin,gestor}'')');
  v_docent text := format('public.has_role(school_id, ''{docent}'')');
  v_mod    text := format('public.module_on(school_id, %L)', p_module);
  v_ins    text;
  v_upd    text;
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format('create policy %I on public.%I for select to authenticated using (public.can_read(school_id, %L))',
                 p_table || '_select', p_table, p_module);

  v_ins := v_staff || case when p_docent_insert then ' or ' || v_docent else '' end;
  execute format('create policy %I on public.%I for insert to authenticated with check (%s and (%s))',
                 p_table || '_insert', p_table, v_mod, v_ins);

  v_upd := v_staff || case when p_docent_update_own
                           then ' or (' || v_docent || ' and created_by = public.current_email())'
                           else '' end;
  execute format('create policy %I on public.%I for update to authenticated using (%s and (%s)) with check (%s and (%s))',
                 p_table || '_update', p_table, v_mod, v_upd, v_mod, v_upd);

  execute format('create policy %I on public.%I for delete to authenticated using (%s and %s)',
                 p_table || '_delete', p_table, v_mod, v_staff);
end $$;

--                                     taula                   mòdul          docent insereix  docent edita el seu
select public._apply_domain_policies('spaces',               'espais',       false,           false);
select public._apply_domain_policies('sessions',             'espais',       true,            true);
select public._apply_domain_policies('projects',             'projectes',    true,            true);
select public._apply_domain_policies('machines',             'maquines',     false,           false);
select public._apply_domain_policies('machine_uses',         'maquines',     true,            true);
select public._apply_domain_policies('maintenance',          'manteniment',  true,            false);
select public._apply_domain_policies('incidents',            'incidencies',  true,            false);
select public._apply_domain_policies('materials',            'prestecs',     false,           false);
select public._apply_domain_policies('loans',                'prestecs',     true,            true);
select public._apply_domain_policies('catalog_items',        'consumibles',  false,           false);
select public._apply_domain_policies('consumables',          'consumibles',  false,           false);
select public._apply_domain_policies('consumable_movements', 'consumibles',  true,            false);

-- L'autor (created_by) el fixa sempre el servidor: ningú no pot crear
-- registres en nom d'un altre ni apropiar-se'n canviant-lo
create or replace function public.tg_created_by()
returns trigger language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_by := public.current_email();
    elsif new.created_by is distinct from old.created_by then
      raise exception 'No es pot canviar l''autor d''un registre';
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['spaces','projects','sessions','machines','materials','machine_uses',
                           'maintenance','incidents','loans','catalog_items','consumables',
                           'consumable_movements']
  loop
    execute format('create trigger set_created_by before insert or update on public.%I
                    for each row execute function public.tg_created_by()', t);
  end loop;
end $$;

-- Funcions internes: no exposades a l'API
revoke execute on function public._apply_domain_policies(text, text, boolean, boolean) from public, anon, authenticated;
