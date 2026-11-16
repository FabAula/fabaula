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
