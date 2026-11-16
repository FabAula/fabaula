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
