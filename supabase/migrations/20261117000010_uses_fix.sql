-- =====================================================================
-- FabAula · 10 · Usos de màquines: finalitzar un altre dia i consumibles
--  1. Un ús es pot acabar un dia diferent del d'inici (ús oblidat obert
--     d'un dia per l'altre). Abans fallava: "machine_uses_check".
--  2. "Material utilitzat" passa a ser un consumible de l'estoc amb
--     quantitat. En finalitzar l'ús es crea la sortida d'estoc sola.
-- =====================================================================

alter table public.machine_uses
  add column if not exists end_date               date,
  add column if not exists consumable_id          uuid,
  add column if not exists consumable_qty         numeric check (consumable_qty is null or consumable_qty > 0),
  add column if not exists consumable_movement_id uuid;

do $$ begin
  alter table public.machine_uses
    add constraint machine_uses_consumable_fk foreign key (consumable_id, school_id)
    references public.consumables (id, school_id) on delete set null (consumable_id);
exception when duplicate_object then null; end $$;

-- Usos antics ja tancats: acaben el mateix dia que van començar
update public.machine_uses set end_date = use_date where end_time is not null and end_date is null;

alter table public.machine_uses drop constraint if exists machine_uses_check;
alter table public.machine_uses drop constraint if exists machine_uses_end_check;
alter table public.machine_uses add constraint machine_uses_end_check check (
  end_time is null
  or (end_date >= use_date and end_date + end_time >= use_date + start_time)
);

create or replace function public.tg_machine_use_finish()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_want    boolean;
  v_machine text;
begin
  -- L'enllaç amb el moviment d'estoc el gestiona només la base de dades
  if tg_op = 'INSERT' then new.consumable_movement_id := null;
  else new.consumable_movement_id := old.consumable_movement_id; end if;

  -- Data de fi
  if new.end_time is null then
    new.end_date := null;
  elsif new.end_date is null then
    if tg_op = 'UPDATE' and old.end_time is null then
      new.end_date := greatest(public.local_today(), new.use_date);   -- es finalitza ara
    elsif tg_op = 'UPDATE' then
      new.end_date := coalesce(old.end_date, new.use_date);
    else
      new.end_date := new.use_date;
    end if;
  end if;

  if new.end_time is not null
     and new.end_date + new.end_time < new.use_date + new.start_time then
    raise exception 'L''hora de fi (% %) és anterior a l''inici (% %). Revisa la data de fi.',
      to_char(new.end_date, 'DD/MM'), to_char(new.end_time, 'HH24:MI'),
      to_char(new.use_date, 'DD/MM'), to_char(new.start_time, 'HH24:MI');
  end if;

  -- Consumible utilitzat → sortida d'estoc
  v_want := new.end_time is not null and new.consumable_id is not null and coalesce(new.consumable_qty, 0) > 0;

  if v_want then
    if not public.module_on(new.school_id, 'consumibles') then
      raise exception 'El mòdul de consumibles no està activat en aquest centre';
    end if;
    select name into v_machine from machines where id = new.machine_id and school_id = new.school_id;

    if new.consumable_movement_id is not null then
      update consumable_movements
         set consumable_id = new.consumable_id, qty = new.consumable_qty, mov_date = new.end_date,
             project_id = new.project_id, user_email = new.user_email, updated_at = now()
       where id = new.consumable_movement_id and school_id = new.school_id;
      if not found then new.consumable_movement_id := null; end if;
    end if;

    if new.consumable_movement_id is null then
      insert into consumable_movements
        (school_id, consumable_id, type, mov_date, qty, user_email, project_id, notes, created_by)
      values
        (new.school_id, new.consumable_id, 'Sortida', new.end_date, new.consumable_qty, new.user_email,
         new.project_id, 'Ús de màquina: ' || coalesce(v_machine, '?'), public.current_email())
      returning id into new.consumable_movement_id;
    end if;
  elsif new.consumable_movement_id is not null then
    delete from consumable_movements where id = new.consumable_movement_id and school_id = new.school_id;
    new.consumable_movement_id := null;
  end if;

  return new;
end $$;

drop trigger if exists machine_use_finish on public.machine_uses;
create trigger machine_use_finish
  before insert or update on public.machine_uses
  for each row execute function public.tg_machine_use_finish();

create or replace function public.tg_machine_use_deleted()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.consumable_movement_id is not null then
    delete from consumable_movements where id = old.consumable_movement_id and school_id = old.school_id;
  end if;
  return old;
end $$;

drop trigger if exists machine_use_deleted on public.machine_uses;
create trigger machine_use_deleted
  after delete on public.machine_uses
  for each row execute function public.tg_machine_use_deleted();

revoke execute on function public.tg_machine_use_finish() from public, anon, authenticated;
revoke execute on function public.tg_machine_use_deleted() from public, anon, authenticated;
