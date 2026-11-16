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
