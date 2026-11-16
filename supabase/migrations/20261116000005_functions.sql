-- =====================================================================
-- FabAula · 05 · Funcions RPC (es criden des del frontend amb supabase.rpc)
-- =====================================================================

-- Copia les llistes per defecte a un centre (sense duplicar)
create or replace function public.seed_default_lists(p_school uuid)
returns void language sql security definer set search_path = public
as $$
  insert into list_items (school_id, list_key, value, sort)
  select p_school, list_key, value, sort from list_defaults
  on conflict (school_id, list_key, value) do nothing
$$;
revoke execute on function public.seed_default_lists(uuid) from public, anon, authenticated;

-- Crear un centre nou amb el seu primer admin (només admin de plataforma)
create or replace function public.create_school(
  p_name text, p_slug text, p_admin_email text, p_admin_name text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'Només un administrador de la plataforma pot crear centres';
  end if;

  insert into schools (name, slug) values (trim(p_name), lower(trim(p_slug)))
  returning id into v_id;

  insert into school_modules (school_id, module, enabled)
  select v_id, key, true from modules;

  perform seed_default_lists(v_id);

  insert into school_members (school_id, email, full_name, role)
  values (v_id, p_admin_email, p_admin_name, 'admin');

  return v_id;
end $$;

-- Centres que pot veure l'usuari actual (on és membre + demos), amb el seu rol
create or replace function public.my_schools()
returns table (id uuid, name text, slug text, is_demo boolean, role public.app_role)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.slug, s.is_demo, m.role
  from schools s
  left join school_members m
    on m.school_id = s.id and m.email = current_email() and m.active
  where m.id is not null or s.is_demo or is_platform_admin()
  order by s.is_demo, s.name
$$;

-- Indicadors del tauler d'inici (respecta RLS: corre amb els permisos de l'usuari)
create or replace function public.dashboard(p_school uuid)
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'sessions_today',   (select count(*) from sessions where school_id = p_school
                          and session_date = public.local_today() and status <> 'Cancel·lada'),
    'machines_in_use',  (select count(*) from machines where school_id = p_school and status = 'En ús'),
    'machines_down',    (select count(*) from machines where school_id = p_school
                          and status in ('Avaria', 'Fora de servei', 'En manteniment')),
    'open_incidents',   (select count(*) from incidents where school_id = p_school
                          and status not in ('Resolta', 'No procedeix')),
    'urgent_incidents', (select count(*) from incidents where school_id = p_school
                          and status not in ('Resolta', 'No procedeix') and priority in ('Alta', 'Urgent')),
    'maintenance_due',  (select count(*) from maintenance where school_id = p_school
                          and status in ('Pendent', 'Programat') and planned_on <= public.local_today() + 7),
    'loans_open',       (select count(*) from loans where school_id = p_school and status = 'Prestat'),
    'loans_overdue',    (select count(*) from loans_overdue where school_id = p_school),
    'low_stock',        (select count(*) from consumables_stock where school_id = p_school
                          and active and stock_status <> 'Correcte')
  )
$$;

-- Per al keep-alive (evita que Supabase pausi el projecte gratuït per inactivitat)
create or replace function public.ping()
returns int language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon;
