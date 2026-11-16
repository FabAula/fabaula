-- =====================================================================
-- FabAula · TOTES LES MIGRACIONS EN UN SOL FITXER
-- Generat amb `npm run sql:bundle`. No l'editis a mà: edita supabase/migrations/.
-- Executa-ho UNA SOLA VEGADA en un projecte de Supabase buit.
-- =====================================================================

-- >>> 20261116000001_core.sql
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

-- >>> 20261116000002_domain.sql
-- =====================================================================
-- FabAula · 02 · Taules de domini
-- Totes porten school_id. Les referències entre taules són compostes
-- (id, school_id) perquè sigui impossible enllaçar dades de dos centres.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Espais i sessions
-- ---------------------------------------------------------------------
create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null,
  description text,
  location    text,
  capacity    int check (capacity is null or capacity >= 0),
  equipment   text,
  rules       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text default public.current_email(),
  updated_at  timestamptz not null default now(),
  unique (id, school_id)
);

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  name            text not null,
  status          text not null default 'En preparació'
                  check (status in ('En preparació','Actiu','Finalitzat','Aturat')),
  course          text,
  groups          text,
  responsible_email text,
  start_date      date,
  end_date        date,
  description     text,
  final_product   text,
  created_at      timestamptz not null default now(),
  created_by      text default public.current_email(),
  updated_at      timestamptz not null default now(),
  unique (id, school_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools (id) on delete cascade,
  session_date  date not null,
  start_time    time not null,
  end_time      time not null,
  teacher_email text default public.current_email(),
  group_name    text,
  project_id    uuid,
  space_id      uuid,
  activity      text,
  status        text not null default 'Programada'
                check (status in ('Programada','Realitzada','Cancel·lada')),
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    text default public.current_email(),
  updated_at    timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (project_id, school_id) references public.projects (id, school_id) on delete set null (project_id),
  foreign key (space_id, school_id)   references public.spaces (id, school_id)   on delete set null (space_id)
);
create index on public.sessions (school_id, session_date);

-- ---------------------------------------------------------------------
-- Màquines, usos i manteniment
-- ---------------------------------------------------------------------
create table public.machines (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  name              text not null,
  brand_model       text,
  category          text,
  location          text,
  responsible_email text,
  manual_url        text,
  instructions_url  text,
  acquired_on       date,
  last_review_on    date,
  status            text not null default 'Operativa'
                    check (status in ('Operativa','En ús','Avaria','En manteniment','Fora de servei')),
  photo_path        text,
  notes             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        text default public.current_email(),
  updated_at        timestamptz not null default now(),
  unique (id, school_id)
);

-- Material inventariable que es presta (el defineixo aquí perquè els usos de màquina hi poden fer referència)
create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null,
  category    text,
  description text,
  total_qty   int not null default 1 check (total_qty >= 0),
  location    text,
  status      text not null default 'Disponible'
              check (status in ('Disponible','Deteriorat','En reparació','Fora de servei')),
  photo_path  text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text default public.current_email(),
  updated_at  timestamptz not null default now(),
  unique (id, school_id)
);

create table public.machine_uses (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  machine_id       uuid not null,
  user_email       text default public.current_email(),
  use_date         date not null default public.local_today(),
  start_time       time not null default public.local_time(),
  planned_end_time time,
  end_time         time,
  project_id       uuid,
  material_id      uuid,
  final_status     text check (final_status in ('Correcte','Incidència','Necessita revisió')),
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       text default public.current_email(),
  updated_at       timestamptz not null default now(),
  check (end_time is null or end_time >= start_time),
  foreign key (machine_id, school_id)  references public.machines (id, school_id)  on delete no action,
  foreign key (project_id, school_id)  references public.projects (id, school_id)  on delete set null (project_id),
  foreign key (material_id, school_id) references public.materials (id, school_id) on delete set null (material_id)
);
create index on public.machine_uses (school_id, machine_id, use_date);

create table public.maintenance (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools (id) on delete cascade,
  machine_id         uuid not null,
  type               text,
  task               text not null,
  planned_on         date,
  done_on            date,
  responsible_email  text,
  periodicity        text,
  status             text not null default 'Pendent'
                     check (status in ('Pendent','Programat','En curs','Realitzat','Cancel·lat')),
  action_description text,
  photo_path         text,
  next_review_on     date,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         text default public.current_email(),
  updated_at         timestamptz not null default now(),
  foreign key (machine_id, school_id) references public.machines (id, school_id) on delete no action
);
create index on public.maintenance (school_id, machine_id);

create table public.incidents (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  inc_date          date not null default public.local_today(),
  inc_time          time not null default public.local_time(),
  reporter_email    text default public.current_email(),
  type              text,
  machine_id        uuid,
  material_id       uuid,
  space_id          uuid,
  affected_item     text,
  description       text not null,
  photo_path        text,
  priority          text not null default 'Mitjana'
                    check (priority in ('Baixa','Mitjana','Alta','Urgent')),
  status            text not null default 'Pendent'
                    check (status in ('Pendent','En revisió','En reparació','Resolta','No procedeix')),
  responsible_email text,
  resolved_on       date,
  resolution        text,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        text default public.current_email(),
  updated_at        timestamptz not null default now(),
  foreign key (machine_id, school_id)  references public.machines (id, school_id)  on delete set null (machine_id),
  foreign key (material_id, school_id) references public.materials (id, school_id) on delete set null (material_id),
  foreign key (space_id, school_id)    references public.spaces (id, school_id)    on delete set null (space_id)
);
create index on public.incidents (school_id, status);

-- ---------------------------------------------------------------------
-- Préstecs
-- ---------------------------------------------------------------------
create table public.loans (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools (id) on delete cascade,
  material_id    uuid not null,
  borrower_email text default public.current_email(),
  out_date       date not null default public.local_today(),
  qty            int  not null default 1 check (qty > 0),
  due_date       date,
  returned_on    date,
  status         text not null default 'Prestat'
                 check (status in ('Prestat','Retornat','Perdut','Deteriorat')),
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     text default public.current_email(),
  updated_at     timestamptz not null default now(),
  foreign key (material_id, school_id) references public.materials (id, school_id) on delete no action
);
create index on public.loans (school_id, material_id, status);

-- ---------------------------------------------------------------------
-- Consumibles
-- ---------------------------------------------------------------------
create table public.catalog_items (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools (id) on delete cascade,
  name          text not null,
  category      text,
  description   text,
  photo_path    text,
  uses          text,
  compatibility text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    text default public.current_email(),
  updated_at    timestamptz not null default now(),
  unique (id, school_id)
);

create table public.consumables (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  catalog_id   uuid,
  variant_name text not null,
  color        text,
  finish       text,
  thickness_mm numeric,
  width_mm     numeric,
  length_mm    numeric,
  format       text,
  stock_unit   text not null default 'Unitats',
  min_stock    numeric not null default 0 check (min_stock >= 0),
  location     text,
  photo_path   text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text default public.current_email(),
  updated_at   timestamptz not null default now(),
  unique (id, school_id),
  foreign key (catalog_id, school_id) references public.catalog_items (id, school_id) on delete set null (catalog_id)
);

create table public.consumable_movements (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  consumable_id     uuid not null,
  type              text not null
                    check (type in ('Entrada','Sortida','Pèrdua o deteriorament','Ajust estoc')),
  mov_date          date not null default public.local_today(),
  qty               numeric not null check (qty <> 0),
  user_email        text default public.current_email(),
  project_id        uuid,
  supplier          text,
  total_price       numeric(10,2) check (total_price is null or total_price >= 0),
  purchase_doc_path text,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        text default public.current_email(),
  updated_at        timestamptz not null default now(),
  check (type = 'Ajust estoc' or qty > 0),
  foreign key (consumable_id, school_id) references public.consumables (id, school_id) on delete cascade,
  foreign key (project_id, school_id)    references public.projects (id, school_id)    on delete set null (project_id)
);
create index on public.consumable_movements (school_id, consumable_id);

-- ---------------------------------------------------------------------
-- updated_at automàtic
-- ---------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql
as $$ begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['spaces','projects','sessions','machines','materials','machine_uses',
                           'maintenance','incidents','loans','catalog_items','consumables',
                           'consumable_movements']
  loop
    execute format('create trigger touch_updated_at before update on public.%I
                    for each row execute function public.tg_touch_updated_at()', t);
  end loop;
end $$;

-- >>> 20261116000003_logic.sql
-- =====================================================================
-- FabAula · 03 · Lògica de negoci: vistes calculades i triggers
-- (substitueix les columnes virtuals, validacions i bots d'AppSheet)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Estoc de consumibles
-- ---------------------------------------------------------------------
create or replace function public.consumable_stock(p_consumable uuid, p_exclude uuid default null)
returns numeric language sql stable security definer set search_path = public
as $$
  select coalesce(sum(case type
                        when 'Entrada' then qty
                        when 'Ajust estoc' then qty
                        else -qty end), 0)
  from consumable_movements
  where consumable_id = p_consumable
    and (p_exclude is null or id <> p_exclude)
$$;

-- Només per a ús intern dels triggers (no exposada a l'API: llegiria estoc d'altres centres)
revoke execute on function public.consumable_stock(uuid, uuid) from public, anon, authenticated;

create view public.consumables_stock with (security_invoker = true) as
select c.*,
       ci.name                                as catalog_name,
       concat_ws(' - ', c.variant_name, c.color) as full_name,
       s.current_stock,
       case when s.current_stock <= 0 then 'Sense estoc'
            when s.current_stock < c.min_stock then 'Cal reposar'
            else 'Correcte' end              as stock_status
from public.consumables c
left join public.catalog_items ci on ci.id = c.catalog_id
cross join lateral (
  select coalesce(sum(case m.type when 'Entrada' then m.qty when 'Ajust estoc' then m.qty else -m.qty end), 0) as current_stock
  from public.consumable_movements m where m.consumable_id = c.id
) s;

create or replace function public.tg_consumable_movement_check()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_stock numeric;
begin
  if new.type in ('Sortida', 'Pèrdua o deteriorament') then
    perform 1 from consumables where id = new.consumable_id and school_id = new.school_id for update;
    if not found then return new; end if;  -- la FK rebutjarà la fila
    v_stock := consumable_stock(new.consumable_id, new.id);
    if new.qty > v_stock then
      raise exception 'No hi ha prou estoc: en queden % i se''n volen treure %', v_stock, new.qty;
    end if;
  elsif new.type = 'Ajust estoc' then
    if not exists (select 1 from consumables where id = new.consumable_id and school_id = new.school_id) then
      return new;
    end if;
    v_stock := consumable_stock(new.consumable_id, new.id);
    if v_stock + new.qty < 0 then
      raise exception 'L''ajust deixaria l''estoc en negatiu (estoc actual: %)', v_stock;
    end if;
  end if;
  return new;
end $$;

create trigger consumable_movement_check
  before insert or update on public.consumable_movements
  for each row execute function public.tg_consumable_movement_check();

-- ---------------------------------------------------------------------
-- Disponibilitat de material de préstec
-- ---------------------------------------------------------------------
create view public.materials_availability with (security_invoker = true) as
select m.*,
       l.lent_qty,
       m.total_qty - l.lent_qty as available_qty
from public.materials m
cross join lateral (
  select coalesce(sum(qty), 0)::int as lent_qty
  from public.loans where material_id = m.id and status = 'Prestat'
) l;

create view public.loans_overdue with (security_invoker = true) as
select l.*, m.name as material_name, public.local_today() - l.due_date as days_late
from public.loans l
join public.materials m on m.id = l.material_id
where l.status = 'Prestat' and l.due_date < public.local_today();

create or replace function public.tg_loan_check()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_total  int;
  v_status text;
  v_lent   int;
begin
  if new.status = 'Retornat' and new.returned_on is null then
    new.returned_on := public.local_today();
  end if;

  if new.status = 'Prestat' then
    select total_qty, status into v_total, v_status
    from materials where id = new.material_id and school_id = new.school_id for update;
    if not found then return new; end if;  -- la FK rebutjarà la fila

    if tg_op = 'INSERT' and v_status <> 'Disponible' then
      raise exception 'Aquest material no està disponible (estat: %)', v_status;
    end if;

    select coalesce(sum(qty), 0) into v_lent
    from loans where material_id = new.material_id and status = 'Prestat' and id <> new.id;

    if new.qty > v_total - v_lent then
      raise exception 'Només hi ha % unitats disponibles', v_total - v_lent;
    end if;
  end if;
  return new;
end $$;

create trigger loan_check
  before insert or update on public.loans
  for each row execute function public.tg_loan_check();

-- ---------------------------------------------------------------------
-- Sessions: un espai no es pot reservar dues vegades a la mateixa hora
-- ---------------------------------------------------------------------
create or replace function public.tg_session_overlap()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_other record;
begin
  if new.space_id is null or new.status = 'Cancel·lada' then
    return new;
  end if;
  select s.start_time, s.end_time, s.teacher_email into v_other
  from sessions s
  where s.space_id = new.space_id
    and s.school_id = new.school_id
    and s.session_date = new.session_date
    and s.status <> 'Cancel·lada'
    and s.id <> new.id
    and s.start_time < new.end_time
    and s.end_time > new.start_time
  limit 1;
  if found then
    raise exception '%', format('L''espai ja està reservat de %s a %s%s',
      to_char(v_other.start_time, 'HH24:MI'), to_char(v_other.end_time, 'HH24:MI'),
      coalesce(' (' || v_other.teacher_email || ')', ''));
  end if;
  return new;
end $$;

create trigger session_overlap
  before insert or update on public.sessions
  for each row execute function public.tg_session_overlap();

-- ---------------------------------------------------------------------
-- Usos de màquina: no es pot iniciar un ús si està ocupada o avariada,
-- i l'estat de la màquina es manté sol (Operativa <-> En ús).
-- ---------------------------------------------------------------------
create or replace function public.tg_machine_use_before()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status from machines where id = new.machine_id and school_id = new.school_id for update;
    if not found then return new; end if;  -- la FK rebutjarà la fila
    if v_status in ('Avaria', 'En manteniment', 'Fora de servei') then
      raise exception 'La màquina no es pot fer servir ara (estat: %)', v_status;
    end if;
    if new.end_time is null and exists (
      select 1 from machine_uses
      where machine_id = new.machine_id and end_time is null and id <> new.id
    ) then
      raise exception 'La màquina ja està en ús. Cal finalitzar l''ús obert abans d''iniciar-ne un de nou';
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_machine_use_after()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_open boolean;
begin
  select exists (select 1 from machine_uses where machine_id = new.machine_id and end_time is null)
    into v_open;

  if v_open then
    update machines set status = 'En ús'
    where id = new.machine_id and status = 'Operativa';
  else
    update machines set status = 'Operativa'
    where id = new.machine_id and status = 'En ús';
  end if;

  -- Si en finalitzar es marca "Incidència", es crea la incidència automàticament
  if new.final_status = 'Incidència'
     and (tg_op = 'INSERT' or old.final_status is distinct from 'Incidència') then
    insert into incidents (school_id, type, machine_id, description, priority, reporter_email, created_by)
    values (new.school_id, 'Màquina', new.machine_id,
            coalesce(nullif(trim(new.notes), ''), 'Incidència indicada en finalitzar un ús de la màquina'),
            'Alta', new.user_email, new.user_email);
  end if;
  return null;
end $$;

create trigger machine_use_before
  before insert or update on public.machine_uses
  for each row execute function public.tg_machine_use_before();

create trigger machine_use_after
  after insert or update on public.machine_uses
  for each row execute function public.tg_machine_use_after();

-- ---------------------------------------------------------------------
-- Incidències: data de resolució automàtica i màquina "Avaria" si és greu
-- ---------------------------------------------------------------------
create or replace function public.tg_incident_before()
returns trigger language plpgsql
as $$
begin
  if new.status in ('Resolta', 'No procedeix') and new.resolved_on is null then
    new.resolved_on := public.local_today();
  elsif new.status not in ('Resolta', 'No procedeix') then
    new.resolved_on := null;
  end if;
  return new;
end $$;

create or replace function public.tg_incident_after()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.machine_id is not null and new.priority in ('Alta', 'Urgent')
     and new.status not in ('Resolta', 'No procedeix') then
    update machines set status = 'Avaria'
    where id = new.machine_id and status in ('Operativa', 'En ús');
  end if;
  return null;
end $$;

create trigger incident_before
  before insert or update on public.incidents
  for each row execute function public.tg_incident_before();

create trigger incident_after
  after insert or update on public.incidents
  for each row execute function public.tg_incident_after();

-- ---------------------------------------------------------------------
-- Manteniment: en marcar "Realitzat" s'actualitza la màquina i es
-- programa automàticament la tasca següent segons la periodicitat.
-- ---------------------------------------------------------------------
create or replace function public.periodicity_interval(p text)
returns interval language sql immutable
as $$
  select case p
    when 'Setmanal'   then interval '7 days'
    when 'Mensual'    then interval '1 month'
    when 'Trimestral' then interval '3 months'
    when 'Semestral'  then interval '6 months'
    when 'Anual'      then interval '1 year'
  end
$$;

create or replace function public.tg_maintenance_before()
returns trigger language plpgsql
as $$
begin
  if new.status = 'Realitzat' then
    new.done_on := coalesce(new.done_on, public.local_today());
    if new.next_review_on is null and public.periodicity_interval(new.periodicity) is not null then
      new.next_review_on := (new.done_on + public.periodicity_interval(new.periodicity))::date;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_maintenance_after()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'En curs' then
    update machines set status = 'En manteniment'
    where id = new.machine_id and status in ('Operativa', 'Avaria');
  end if;

  if new.status = 'Realitzat' and (tg_op = 'INSERT' or old.status is distinct from 'Realitzat') then
    update machines
       set last_review_on = greatest(coalesce(last_review_on, new.done_on), new.done_on),
           status = case when status = 'En manteniment' then 'Operativa' else status end
     where id = new.machine_id;

    if new.next_review_on is not null and not exists (
      select 1 from maintenance
      where machine_id = new.machine_id and task = new.task
        and status in ('Pendent', 'Programat') and planned_on = new.next_review_on
    ) then
      insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email,
                               periodicity, status, created_by)
      values (new.school_id, new.machine_id, new.type, new.task, new.next_review_on,
              new.responsible_email, new.periodicity, 'Programat', new.created_by);
    end if;
  end if;
  return null;
end $$;

create trigger maintenance_before
  before insert or update on public.maintenance
  for each row execute function public.tg_maintenance_before();

create trigger maintenance_after
  after insert or update on public.maintenance
  for each row execute function public.tg_maintenance_after();

-- ---------------------------------------------------------------------
-- Defensa extra: school_id no es pot canviar mai
-- ---------------------------------------------------------------------
create or replace function public.tg_lock_school_id()
returns trigger language plpgsql
as $$
begin
  if new.school_id <> old.school_id then
    raise exception 'No es pot canviar el centre d''un registre';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['spaces','projects','sessions','machines','materials','machine_uses',
                           'maintenance','incidents','loans','catalog_items','consumables',
                           'consumable_movements','school_members','list_items']
  loop
    execute format('create trigger lock_school_id before update of school_id on public.%I
                    for each row execute function public.tg_lock_school_id()', t);
  end loop;
end $$;

-- >>> 20261116000004_security.sql
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

-- >>> 20261116000005_functions.sql
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

-- >>> 20261116000006_storage.sql
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

-- >>> 20261116000007_demo.sql
-- =====================================================================
-- FabAula · 07 · Centre de demostració
-- Qualsevol usuari autenticat el pot consultar (només lectura) per veure
-- com funciona cada mòdul abans d'activar-lo al seu centre.
-- reset_demo() l'esborra i el torna a crear amb dates relatives a avui.
-- =====================================================================

create or replace function public.reset_demo()
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_school uuid;
  d date := public.local_today();
  sp_aula uuid; sp_taller uuid;
  pr_robot uuid; pr_llums uuid; pr_hort uuid;
  mq_3d uuid; mq_laser uuid; mq_vinil uuid; mq_brod uuid;
  mt_microbit uuid; mt_spike uuid; mt_beebot uuid; mt_eines uuid;
  ct_pla uuid; ct_dm uuid; ct_vinil uuid;
  cs_pla_blanc uuid; cs_pla_verd uuid; cs_dm3 uuid; cs_vinil_negre uuid;
  maint_id uuid;
begin
  -- Si la crida ve de l'API (hi ha JWT), només la pot fer un admin de plataforma.
  -- Sense JWT (editor SQL, pg_cron) sempre es permet.
  if current_email() <> '' and not is_platform_admin() then
    raise exception 'No autoritzat';
  end if;

  delete from schools where slug = 'demo';
  insert into schools (name, slug, is_demo) values ('Escola de demostració', 'demo', true)
  returning id into v_school;

  insert into school_modules (school_id, module, enabled) select v_school, key, true from modules;
  perform seed_default_lists(v_school);

  insert into school_members (school_id, email, full_name, role) values
    (v_school, 'direccio@demo.fabaula',  'Direcció (demo)',  'admin'),
    (v_school, 'coordinacio@demo.fabaula', 'Equip motor (demo)', 'gestor'),
    (v_school, 'mestra1@demo.fabaula',   'Mestra 5è (demo)', 'docent'),
    (v_school, 'mestra2@demo.fabaula',   'Mestre 6è (demo)', 'docent');

  -- Espais
  insert into spaces (school_id, name, location, capacity, equipment, rules, created_by)
  values (v_school, 'Aula Maker', 'Planta baixa', 26, 'Impressores 3D, làser, plòter de vinil, brodadora',
          'Ulleres de protecció obligatòries amb el làser. Deixar les màquines netes.', 'coordinacio@demo.fabaula')
  returning id into sp_aula;
  insert into spaces (school_id, name, location, capacity, created_by)
  values (v_school, 'Taller de tecnologia', 'Primera planta', 20, 'coordinacio@demo.fabaula')
  returning id into sp_taller;

  -- Projectes
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Robots que reciclen', 'Actiu', '5è', '5è A, 5è B', 'mestra1@demo.fabaula',
          d - 20, d + 40, 'Disseny d''un robot classificador de residus amb micro:bit', 'Prototip de robot', 'mestra1@demo.fabaula')
  returning id into pr_robot;
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Llums de Nadal', 'En preparació', '6è', '6è A', 'mestra2@demo.fabaula',
          d + 5, d + 30, 'Decoració lluminosa tallada amb làser i circuits senzills', 'Fanalets de DM', 'mestra2@demo.fabaula')
  returning id into pr_llums;
  insert into projects (school_id, name, status, course, responsible_email, start_date, end_date, created_by)
  values (v_school, 'Hort intel·ligent', 'Finalitzat', '5è', 'mestra1@demo.fabaula', d - 120, d - 30, 'mestra1@demo.fabaula')
  returning id into pr_hort;

  -- Sessions
  insert into sessions (school_id, session_date, start_time, end_time, teacher_email, group_name, project_id, space_id, activity, status, created_by) values
    (v_school, d - 7, '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Muntatge del xassís', 'Realitzada', 'mestra1@demo.fabaula'),
    (v_school, d,     '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Programació dels sensors', 'Programada', 'mestra1@demo.fabaula'),
    (v_school, d,     '11:00', '12:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_aula, 'Disseny dels fanalets a Inkscape', 'Programada', 'mestra2@demo.fabaula'),
    (v_school, d + 2, '15:00', '16:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_taller, 'Soldadura de LEDs', 'Programada', 'mestra2@demo.fabaula');

  -- Màquines
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Impressora 3D 1', 'Prusa MK4', 'Impressora 3D', 'Aula Maker', 'coordinacio@demo.fabaula', d - 400, d - 25, 'coordinacio@demo.fabaula')
  returning id into mq_3d;
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Làser', 'xTool S1', 'Tall i gravat làser', 'Aula Maker', 'coordinacio@demo.fabaula', d - 300, d - 60, 'coordinacio@demo.fabaula')
  returning id into mq_laser;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Plòter de vinil', 'Cricut Maker 3', 'Tall de vinil', 'Aula Maker', d - 500, 'coordinacio@demo.fabaula')
  returning id into mq_vinil;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Brodadora', 'Brother Innov-is', 'Brodat', 'Taller de tecnologia', d - 200, 'coordinacio@demo.fabaula')
  returning id into mq_brod;

  -- Material de préstec
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Kit micro:bit v2', 'Robòtica', 12, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_microbit;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'LEGO Spike Prime', 'Robòtica', 6, 'Armari 2', 'coordinacio@demo.fabaula') returning id into mt_spike;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Bee-Bot', 'Robòtica', 8, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_beebot;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Caixa d''eines', 'Eines manuals', 4, 'Taller', 'coordinacio@demo.fabaula') returning id into mt_eines;

  -- Usos de màquina (un d'obert → la impressora queda "En ús")
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, end_time, project_id, final_status, created_by) values
    (v_school, mq_laser, 'mestra2@demo.fabaula', d - 3, '11:00', '11:45', pr_llums, 'Correcte', 'mestra2@demo.fabaula'),
    (v_school, mq_3d,    'mestra1@demo.fabaula', d - 7, '09:15', '10:20', pr_robot, 'Correcte', 'mestra1@demo.fabaula');
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, planned_end_time, project_id, created_by) values
    (v_school, mq_3d, 'mestra1@demo.fabaula', d, '09:05', '10:30', pr_robot, 'mestra1@demo.fabaula');

  -- Manteniment
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, created_by) values
    (v_school, mq_laser, 'Neteja', 'Netejar lent i miralls', d + 3, 'coordinacio@demo.fabaula', 'Mensual', 'Programat', 'coordinacio@demo.fabaula'),
    (v_school, mq_vinil, 'Preventiu', 'Canviar la fulla de tall', d - 2, 'coordinacio@demo.fabaula', 'Trimestral', 'Pendent', 'coordinacio@demo.fabaula');
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, action_description, created_by)
  values (v_school, mq_3d, 'Calibratge', 'Calibrar el llit', d - 25, 'coordinacio@demo.fabaula', 'Mensual', 'Pendent', 'Calibratge en 9 punts', 'coordinacio@demo.fabaula')
  returning id into maint_id;
  update maintenance set status = 'Realitzat', done_on = d - 25 where id = maint_id;  -- programa la següent automàticament

  -- Incidències (la urgent posa la brodadora en "Avaria")
  insert into incidents (school_id, inc_date, reporter_email, type, machine_id, description, priority, status, created_by) values
    (v_school, d - 1, 'mestra2@demo.fabaula', 'Màquina', mq_brod, 'L''agulla es trenca en començar a brodar', 'Urgent', 'Pendent', 'mestra2@demo.fabaula'),
    (v_school, d - 10, 'mestra1@demo.fabaula', 'Material', null, 'Falten 2 cables USB al kit micro:bit', 'Baixa', 'Resolta', 'mestra1@demo.fabaula');
  update incidents set material_id = mt_microbit, resolution = 'Comprats cables nous', resolved_on = d - 8
  where school_id = v_school and type = 'Material';

  -- Préstecs (un d'endarrerit)
  insert into loans (school_id, material_id, borrower_email, out_date, qty, due_date, status, created_by) values
    (v_school, mt_microbit, 'mestra1@demo.fabaula', d - 5, 6, d + 10, 'Prestat', 'mestra1@demo.fabaula'),
    (v_school, mt_beebot,   'mestra2@demo.fabaula', d - 15, 4, d - 2, 'Prestat', 'mestra2@demo.fabaula'),
    (v_school, mt_spike,    'mestra2@demo.fabaula', d - 30, 2, d - 20, 'Retornat', 'mestra2@demo.fabaula');

  -- Catàleg i consumibles
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Filament PLA 1,75 mm', 'Impressió 3D', 'Peces i prototips', 'Impressora 3D', 'coordinacio@demo.fabaula') returning id into ct_pla;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Tauler DM', 'Fusta i derivats', 'Tall i gravat', 'Làser', 'coordinacio@demo.fabaula') returning id into ct_dm;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Vinil adhesiu', 'Vinils', 'Retolació i adhesius', 'Plòter de vinil', 'coordinacio@demo.fabaula') returning id into ct_vinil;

  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Blanc', 'Bobina', 'Bobines', 2, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_blanc;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Verd', 'Bobina', 'Bobines', 1, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_verd;
  insert into consumables (school_id, catalog_id, variant_name, color, thickness_mm, width_mm, length_mm, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_dm, 'DM 3 mm', 'Natural', 3, 400, 300, 'Planxa', 'Planxes', 10, 'Calaix làser', 'coordinacio@demo.fabaula') returning id into cs_dm3;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_vinil, 'Vinil mat', 'Negre', 'Rotlle', 'Metres', 2, 'Calaix vinil', 'coordinacio@demo.fabaula') returning id into cs_vinil_negre;

  insert into consumable_movements (school_id, consumable_id, type, mov_date, qty, user_email, project_id, supplier, total_price, created_by) values
    (v_school, cs_pla_blanc,   'Entrada', d - 60, 5,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 99.75, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_blanc,   'Sortida', d - 7,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_pla_verd,    'Entrada', d - 60, 1,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 19.95, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_verd,    'Sortida', d - 3,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_dm3,         'Entrada', d - 40, 25, 'coordinacio@demo.fabaula', null, 'Fusteria del barri', 45.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_dm3,         'Sortida', d - 3,  17, 'mestra2@demo.fabaula', pr_llums, null, null, 'mestra2@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Entrada', d - 90, 10, 'coordinacio@demo.fabaula', null, 'Papereria', 30.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Sortida', d - 20, 3,  'mestra2@demo.fabaula', null, null, null, 'mestra2@demo.fabaula');

  return v_school;
end $$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;  -- la funció comprova internament que siguis admin de plataforma

-- Crea la demo ara mateix
select public.reset_demo();

-- >>> 20261116000008_branding.sql
-- =====================================================================
-- FabAula · 08 · Identitat de cada centre (color i logotip)
-- =====================================================================

alter table public.schools
  add column brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column logo_path   text;

-- my_schools() ara també retorna el color i el logotip
drop function if exists public.my_schools();
create function public.my_schools()
returns table (id uuid, name text, slug text, is_demo boolean, role public.app_role,
               brand_color text, logo_path text)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.slug, s.is_demo, m.role, s.brand_color, s.logo_path
  from schools s
  left join school_members m
    on m.school_id = s.id and m.email = current_email() and m.active
  where m.id is not null or s.is_demo or is_platform_admin()
  order by s.is_demo, s.name
$$;

-- L'admin del centre pot canviar nom, color i logotip, però no l'identificador
-- ni si és de demo (això només ho pot fer l'admin de plataforma)
create or replace function public.tg_schools_guard()
returns trigger language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_platform_admin()
     and (new.slug is distinct from old.slug or new.is_demo is distinct from old.is_demo) then
    raise exception 'Només l''administrador de la plataforma pot canviar l''identificador del centre';
  end if;
  return new;
end $$;

create trigger schools_guard
  before update on public.schools
  for each row execute function public.tg_schools_guard();

-- La demo també té color (i el manté en reiniciar-se)
create or replace function public.reset_demo()
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_school uuid;
  d date := public.local_today();
  sp_aula uuid; sp_taller uuid;
  pr_robot uuid; pr_llums uuid; pr_hort uuid;
  mq_3d uuid; mq_laser uuid; mq_vinil uuid; mq_brod uuid;
  mt_microbit uuid; mt_spike uuid; mt_beebot uuid; mt_eines uuid;
  ct_pla uuid; ct_dm uuid; ct_vinil uuid;
  cs_pla_blanc uuid; cs_pla_verd uuid; cs_dm3 uuid; cs_vinil_negre uuid;
  maint_id uuid;
begin
  -- Si la crida ve de l'API (hi ha JWT), només la pot fer un admin de plataforma.
  -- Sense JWT (editor SQL, pg_cron) sempre es permet.
  if current_email() <> '' and not is_platform_admin() then
    raise exception 'No autoritzat';
  end if;

  delete from schools where slug = 'demo';
  insert into schools (name, slug, is_demo, brand_color) values ('Escola de demostració', 'demo', true, '#1f6f5c')
  returning id into v_school;

  insert into school_modules (school_id, module, enabled) select v_school, key, true from modules;
  perform seed_default_lists(v_school);

  insert into school_members (school_id, email, full_name, role) values
    (v_school, 'direccio@demo.fabaula',  'Direcció (demo)',  'admin'),
    (v_school, 'coordinacio@demo.fabaula', 'Equip motor (demo)', 'gestor'),
    (v_school, 'mestra1@demo.fabaula',   'Mestra 5è (demo)', 'docent'),
    (v_school, 'mestra2@demo.fabaula',   'Mestre 6è (demo)', 'docent');

  -- Espais
  insert into spaces (school_id, name, location, capacity, equipment, rules, created_by)
  values (v_school, 'Aula Maker', 'Planta baixa', 26, 'Impressores 3D, làser, plòter de vinil, brodadora',
          'Ulleres de protecció obligatòries amb el làser. Deixar les màquines netes.', 'coordinacio@demo.fabaula')
  returning id into sp_aula;
  insert into spaces (school_id, name, location, capacity, created_by)
  values (v_school, 'Taller de tecnologia', 'Primera planta', 20, 'coordinacio@demo.fabaula')
  returning id into sp_taller;

  -- Projectes
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Robots que reciclen', 'Actiu', '5è', '5è A, 5è B', 'mestra1@demo.fabaula',
          d - 20, d + 40, 'Disseny d''un robot classificador de residus amb micro:bit', 'Prototip de robot', 'mestra1@demo.fabaula')
  returning id into pr_robot;
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Llums de Nadal', 'En preparació', '6è', '6è A', 'mestra2@demo.fabaula',
          d + 5, d + 30, 'Decoració lluminosa tallada amb làser i circuits senzills', 'Fanalets de DM', 'mestra2@demo.fabaula')
  returning id into pr_llums;
  insert into projects (school_id, name, status, course, responsible_email, start_date, end_date, created_by)
  values (v_school, 'Hort intel·ligent', 'Finalitzat', '5è', 'mestra1@demo.fabaula', d - 120, d - 30, 'mestra1@demo.fabaula')
  returning id into pr_hort;

  -- Sessions
  insert into sessions (school_id, session_date, start_time, end_time, teacher_email, group_name, project_id, space_id, activity, status, created_by) values
    (v_school, d - 7, '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Muntatge del xassís', 'Realitzada', 'mestra1@demo.fabaula'),
    (v_school, d,     '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Programació dels sensors', 'Programada', 'mestra1@demo.fabaula'),
    (v_school, d,     '11:00', '12:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_aula, 'Disseny dels fanalets a Inkscape', 'Programada', 'mestra2@demo.fabaula'),
    (v_school, d + 2, '15:00', '16:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_taller, 'Soldadura de LEDs', 'Programada', 'mestra2@demo.fabaula');

  -- Màquines
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Impressora 3D 1', 'Prusa MK4', 'Impressora 3D', 'Aula Maker', 'coordinacio@demo.fabaula', d - 400, d - 25, 'coordinacio@demo.fabaula')
  returning id into mq_3d;
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Làser', 'xTool S1', 'Tall i gravat làser', 'Aula Maker', 'coordinacio@demo.fabaula', d - 300, d - 60, 'coordinacio@demo.fabaula')
  returning id into mq_laser;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Plòter de vinil', 'Cricut Maker 3', 'Tall de vinil', 'Aula Maker', d - 500, 'coordinacio@demo.fabaula')
  returning id into mq_vinil;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Brodadora', 'Brother Innov-is', 'Brodat', 'Taller de tecnologia', d - 200, 'coordinacio@demo.fabaula')
  returning id into mq_brod;

  -- Material de préstec
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Kit micro:bit v2', 'Robòtica', 12, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_microbit;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'LEGO Spike Prime', 'Robòtica', 6, 'Armari 2', 'coordinacio@demo.fabaula') returning id into mt_spike;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Bee-Bot', 'Robòtica', 8, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_beebot;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Caixa d''eines', 'Eines manuals', 4, 'Taller', 'coordinacio@demo.fabaula') returning id into mt_eines;

  -- Usos de màquina (un d'obert → la impressora queda "En ús")
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, end_time, project_id, final_status, created_by) values
    (v_school, mq_laser, 'mestra2@demo.fabaula', d - 3, '11:00', '11:45', pr_llums, 'Correcte', 'mestra2@demo.fabaula'),
    (v_school, mq_3d,    'mestra1@demo.fabaula', d - 7, '09:15', '10:20', pr_robot, 'Correcte', 'mestra1@demo.fabaula');
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, planned_end_time, project_id, created_by) values
    (v_school, mq_3d, 'mestra1@demo.fabaula', d, '09:05', '10:30', pr_robot, 'mestra1@demo.fabaula');

  -- Manteniment
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, created_by) values
    (v_school, mq_laser, 'Neteja', 'Netejar lent i miralls', d + 3, 'coordinacio@demo.fabaula', 'Mensual', 'Programat', 'coordinacio@demo.fabaula'),
    (v_school, mq_vinil, 'Preventiu', 'Canviar la fulla de tall', d - 2, 'coordinacio@demo.fabaula', 'Trimestral', 'Pendent', 'coordinacio@demo.fabaula');
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, action_description, created_by)
  values (v_school, mq_3d, 'Calibratge', 'Calibrar el llit', d - 25, 'coordinacio@demo.fabaula', 'Mensual', 'Pendent', 'Calibratge en 9 punts', 'coordinacio@demo.fabaula')
  returning id into maint_id;
  update maintenance set status = 'Realitzat', done_on = d - 25 where id = maint_id;  -- programa la següent automàticament

  -- Incidències (la urgent posa la brodadora en "Avaria")
  insert into incidents (school_id, inc_date, reporter_email, type, machine_id, description, priority, status, created_by) values
    (v_school, d - 1, 'mestra2@demo.fabaula', 'Màquina', mq_brod, 'L''agulla es trenca en començar a brodar', 'Urgent', 'Pendent', 'mestra2@demo.fabaula'),
    (v_school, d - 10, 'mestra1@demo.fabaula', 'Material', null, 'Falten 2 cables USB al kit micro:bit', 'Baixa', 'Resolta', 'mestra1@demo.fabaula');
  update incidents set material_id = mt_microbit, resolution = 'Comprats cables nous', resolved_on = d - 8
  where school_id = v_school and type = 'Material';

  -- Préstecs (un d'endarrerit)
  insert into loans (school_id, material_id, borrower_email, out_date, qty, due_date, status, created_by) values
    (v_school, mt_microbit, 'mestra1@demo.fabaula', d - 5, 6, d + 10, 'Prestat', 'mestra1@demo.fabaula'),
    (v_school, mt_beebot,   'mestra2@demo.fabaula', d - 15, 4, d - 2, 'Prestat', 'mestra2@demo.fabaula'),
    (v_school, mt_spike,    'mestra2@demo.fabaula', d - 30, 2, d - 20, 'Retornat', 'mestra2@demo.fabaula');

  -- Catàleg i consumibles
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Filament PLA 1,75 mm', 'Impressió 3D', 'Peces i prototips', 'Impressora 3D', 'coordinacio@demo.fabaula') returning id into ct_pla;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Tauler DM', 'Fusta i derivats', 'Tall i gravat', 'Làser', 'coordinacio@demo.fabaula') returning id into ct_dm;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Vinil adhesiu', 'Vinils', 'Retolació i adhesius', 'Plòter de vinil', 'coordinacio@demo.fabaula') returning id into ct_vinil;

  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Blanc', 'Bobina', 'Bobines', 2, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_blanc;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Verd', 'Bobina', 'Bobines', 1, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_verd;
  insert into consumables (school_id, catalog_id, variant_name, color, thickness_mm, width_mm, length_mm, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_dm, 'DM 3 mm', 'Natural', 3, 400, 300, 'Planxa', 'Planxes', 10, 'Calaix làser', 'coordinacio@demo.fabaula') returning id into cs_dm3;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_vinil, 'Vinil mat', 'Negre', 'Rotlle', 'Metres', 2, 'Calaix vinil', 'coordinacio@demo.fabaula') returning id into cs_vinil_negre;

  insert into consumable_movements (school_id, consumable_id, type, mov_date, qty, user_email, project_id, supplier, total_price, created_by) values
    (v_school, cs_pla_blanc,   'Entrada', d - 60, 5,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 99.75, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_blanc,   'Sortida', d - 7,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_pla_verd,    'Entrada', d - 60, 1,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 19.95, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_verd,    'Sortida', d - 3,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_dm3,         'Entrada', d - 40, 25, 'coordinacio@demo.fabaula', null, 'Fusteria del barri', 45.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_dm3,         'Sortida', d - 3,  17, 'mestra2@demo.fabaula', pr_llums, null, null, 'mestra2@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Entrada', d - 90, 10, 'coordinacio@demo.fabaula', null, 'Papereria', 30.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Sortida', d - 20, 3,  'mestra2@demo.fabaula', null, null, null, 'mestra2@demo.fabaula');

  return v_school;
end $$;

update public.schools set brand_color = '#1f6f5c' where is_demo;

-- >>> 20261116000009_feedback.sql
-- =====================================================================
-- FabAula · 09 · Suggeriments, queixes i errors des de l'app
-- Antispam: només usuaris autenticats, en nom propi, missatges de
-- 10-2000 caràcters i com a màxim 5 al dia per persona.
-- =====================================================================

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid references public.schools (id) on delete set null,
  email      text not null default public.current_email(),
  kind       text not null check (kind in ('Millora', 'Queixa', 'Error', 'Altres')),
  message    text not null check (length(trim(message)) between 10 and 2000),
  page       text,
  status     text not null default 'Nou' check (status in ('Nou', 'Llegit', 'Fet', 'Descartat')),
  created_at timestamptz not null default now()
);
create index on public.feedback (email, created_at);

-- Sense security definer: així current_user és el de la petició i els recomptes
-- només veuen (per RLS) els missatges propis, que és el que cal comptar
create or replace function public.tg_feedback_guard()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.email := current_email();
    new.status := 'Nou';
    new.created_at := now();
    if new.email = '' then
      raise exception 'Cal haver iniciat sessió';
    end if;
    if new.school_id is not null and not (is_member(new.school_id) or is_demo(new.school_id)) then
      new.school_id := null;
    end if;
    if (select count(*) from feedback where email = new.email and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Has enviat molts missatges avui. Torna-ho a provar demà, si us plau.';
    end if;
    if exists (select 1 from feedback where email = new.email and message = new.message) then
      raise exception 'Aquest missatge ja l''havies enviat.';
    end if;
  end if;
  return new;
end $$;

create trigger feedback_guard
  before insert on public.feedback
  for each row execute function public.tg_feedback_guard();

alter table public.feedback enable row level security;
grant select, insert, update on public.feedback to authenticated;

create policy feedback_insert on public.feedback for insert to authenticated
  with check (true);  -- el trigger ja força l'autor i aplica els límits
create policy feedback_select on public.feedback for select to authenticated
  using (email = public.current_email() or public.is_platform_admin());
create policy feedback_update on public.feedback for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
