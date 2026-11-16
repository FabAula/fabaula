-- =====================================================================
-- FabAula · 01 · Nucli multi-centre
-- Centres, mòduls, membres (rols), llistes configurables i funcions
-- d'ajuda per a les polítiques RLS.
-- =====================================================================

-- Data i hora locals (Catalunya). El servidor de Supabase treballa en UTC:
-- sense això, a les 00:30 d'aquí "avui" seria encara ahir.
create or replace function public.local_today()
returns date language sql stable
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

create or replace function public.local_time()
returns time language sql stable
as $$ select (now() at time zone 'Europe/Madrid')::time(0) $$;

create type public.app_role as enum ('admin', 'gestor', 'docent');

-- ---------------------------------------------------------------------
-- Centres
-- ---------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Administradors de la plataforma (tu). Poden crear centres i gestionar-ne
-- els membres, però NO veuen les dades dels centres si no en són membres.
create table public.platform_admins (
  email text primary key check (email = lower(email))
);

-- ---------------------------------------------------------------------
-- Mòduls (funcionalitats activables per centre)
-- ---------------------------------------------------------------------
create table public.modules (
  key         text primary key,
  name        text not null,
  description text not null,
  sort        int  not null
);

insert into public.modules (key, name, description, sort) values
  ('espais',      'Espais i sessions',   'Calendari de sessions a l''aula, amb control de solapaments per espai.', 1),
  ('projectes',   'Projectes',           'Projectes per curs i grup; agrupen sessions, usos de màquines i consum.', 2),
  ('maquines',    'Màquines i usos',     'Inventari de màquines i registre de qui les fa servir i quan.', 3),
  ('manteniment', 'Manteniment',         'Tasques de manteniment amb periodicitat i programació automàtica de la següent.', 4),
  ('incidencies', 'Incidències',         'Avaries i problemes amb prioritat, estat i resolució.', 5),
  ('prestecs',    'Préstec de material', 'Material inventariable que es presta i es retorna, amb control de disponibilitat.', 6),
  ('consumibles', 'Consumibles i estoc', 'Catàleg de materials consumibles, entrades, consum i avís d''estoc mínim.', 7);

create table public.school_modules (
  school_id uuid not null references public.schools (id) on delete cascade,
  module    text not null references public.modules (key),
  enabled   boolean not null default true,
  primary key (school_id, module)
);

-- ---------------------------------------------------------------------
-- Membres del centre
-- L'usuari s'identifica pel correu del seu compte de Google.
-- L'admin del centre afegeix correus; quan aquella persona entra amb
-- Google ja té accés.
-- ---------------------------------------------------------------------
create table public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id) on delete cascade,
  email      text not null check (email = lower(email) and email like '%@%'),
  full_name  text,
  role       public.app_role not null default 'docent',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, email)
);
create index on public.school_members (email);

-- ---------------------------------------------------------------------
-- Llistes configurables per centre (grups, categories, unitats...)
-- ---------------------------------------------------------------------
create table public.list_defs (
  key         text primary key,
  name        text not null,
  description text,
  sort        int not null
);

create table public.list_defaults (
  list_key text not null references public.list_defs (key),
  value    text not null,
  sort     int  not null,
  primary key (list_key, value)
);

create table public.list_items (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id) on delete cascade,
  list_key   text not null references public.list_defs (key),
  value      text not null check (length(trim(value)) > 0),
  sort       int  not null default 0,
  active     boolean not null default true,
  unique (school_id, list_key, value)
);

insert into public.list_defs (key, name, description, sort) values
  ('grups',             'Grups',                        'Grups classe que poden fer sessions', 1),
  ('cat_maquines',      'Categories de màquines',       null, 2),
  ('cat_materials',     'Categories de material de préstec', null, 3),
  ('cat_cataleg',       'Categories del catàleg de consumibles', null, 4),
  ('formats',           'Formats de consumible',        null, 5),
  ('unitats',           'Unitats d''estoc',             null, 6),
  ('tipus_incidencia',  'Tipus d''incidència',          null, 7),
  ('tipus_manteniment', 'Tipus de manteniment',         null, 8),
  ('periodicitats',     'Periodicitats de manteniment', 'Setmanal, Mensual, Trimestral, Semestral i Anual programen automàticament la tasca següent', 9);

insert into public.list_defaults (list_key, value, sort)
select k, v, ord::int from (values
  ('grups', array['1r','2n','3r','4t','5è','6è','Sense grup','Altres']),
  ('cat_maquines', array['Impressora 3D','Tall i gravat làser','Tall de vinil','Brodat','Escaneig 3D','Eina de fabricació digital']),
  ('cat_materials', array['Robòtica','Electrònica','Eines manuals','Construcció','Ciència','Design thinking','Perifèrics de robòtica']),
  ('cat_cataleg', array['Fusta i derivats','Plàstics','Impressió 3D','Vinils','Paper i cartró','Materials flexibles','Adhesius','Material tèxtil','Electrònica','Pintures i acabats','Altres']),
  ('formats', array['Planxa','Bobina','Rotlle','Full','Peça','Pot','Ampolla','Paquet','Caixa','Altres']),
  ('unitats', array['Unitats','Grams','Quilograms','Metres','Litres','Mil·lilitres','Planxes','Bobines','Rotlles','Paquets','Pots']),
  ('tipus_incidencia', array['Màquina','Eina','Material','Consumible','Instal·lació','Mobiliari','Seguretat','Altres']),
  ('tipus_manteniment', array['Preventiu','Correctiu','Neteja','Calibratge','Revisió de seguretat','Actualització']),
  ('periodicitats', array['Després de cada ús','Setmanal','Mensual','Trimestral','Semestral','Anual','Quan sigui necessari'])
) as t(k, vals), unnest(vals) with ordinality as u(v, ord);

-- ---------------------------------------------------------------------
-- Funcions d'ajuda (fan servir el JWT de Supabase Auth)
-- ---------------------------------------------------------------------
create or replace function public.current_email()
returns text language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable
as $$ begin return p::uuid; exception when others then return null; end $$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from platform_admins where email = current_email()) $$;

create or replace function public.my_role(p_school uuid)
returns public.app_role language sql stable security definer set search_path = public
as $$
  select role from school_members
  where school_id = p_school and email = current_email() and active
$$;

create or replace function public.is_member(p_school uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select my_role(p_school) is not null $$;

create or replace function public.has_role(p_school uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(my_role(p_school) = any (p_roles), false) $$;

create or replace function public.is_demo(p_school uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_demo from schools where id = p_school), false) $$;

create or replace function public.module_on(p_school uuid, p_module text)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_module is null
      or coalesce((select enabled from school_modules
                   where school_id = p_school and module = p_module), false)
$$;

-- Pot llegir dades d'un centre: membre actiu, o centre de demo (lectura per a tothom)
create or replace function public.can_read(p_school uuid, p_module text default null)
returns boolean language sql stable security definer set search_path = public
as $$ select (is_member(p_school) or is_demo(p_school)) and module_on(p_school, p_module) $$;

-- ---------------------------------------------------------------------
-- Integritat dels membres
-- ---------------------------------------------------------------------
create or replace function public.tg_members_normalize()
returns trigger language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

create trigger members_normalize
  before insert or update of email on public.school_members
  for each row execute function public.tg_members_normalize();

-- Un centre no pot quedar-se mai sense cap admin actiu
create or replace function public.tg_members_keep_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_school uuid := coalesce(old.school_id, new.school_id);
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active) then
    if not exists (
      select 1 from school_members
      where school_id = v_school and role = 'admin' and active and id <> old.id
    ) and exists (select 1 from schools where id = v_school) then
      raise exception 'El centre ha de tenir com a mínim un administrador actiu';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger members_keep_admin
  before update or delete on public.school_members
  for each row execute function public.tg_members_keep_admin();
