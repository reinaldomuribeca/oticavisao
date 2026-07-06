-- 0004_editions.sql — Edições de sorteio (isolamento por edição)
-- Aplicar no SQL Editor do Supabase. Migração FORWARD (uma vez).
-- Guardas if [not] exists / DO blocks evitam a maioria dos erros em reexecução,
-- mas a migração de dados do raffle_config e os drops finais são one-shot.

-- =====================================================================
-- 1) Tabela editions
-- =====================================================================
create table if not exists public.editions (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  is_active             boolean not null default false,
  cadastros_encerrados  boolean not null default false,
  last_number           integer not null default 0,
  winner_number         integer,
  drawn_at              timestamptz,
  created_at            timestamptz not null default now(),
  closed_at             timestamptz
);

-- No máximo uma edição ativa por vez
create unique index if not exists editions_single_active_idx
  on public.editions (is_active) where is_active;

alter table public.editions enable row level security;

-- =====================================================================
-- 2) Cria "Edição 1" (ativa) se nenhuma edição existir ainda
-- =====================================================================
insert into public.editions (name, is_active, cadastros_encerrados)
select 'Edição 1', true, false
where not exists (select 1 from public.editions);

-- =====================================================================
-- 3) Colunas edition_id (nullable primeiro, para backfill)
-- =====================================================================
alter table public.participants
  add column if not exists edition_id uuid references public.editions(id);
alter table public.raffle_numbers
  add column if not exists edition_id uuid references public.editions(id);

-- =====================================================================
-- 4) Backfill -> Edição 1 (a ativa recém-criada)
-- =====================================================================
update public.participants
  set edition_id = (select id from public.editions where is_active limit 1)
  where edition_id is null;
update public.raffle_numbers
  set edition_id = (select id from public.editions where is_active limit 1)
  where edition_id is null;

-- =====================================================================
-- 5) Migra o singleton raffle_config -> Edição 1 (se ainda existir)
-- =====================================================================
do $$
begin
  if to_regclass('public.raffle_config') is not null then
    update public.editions e
      set winner_number        = rc.winner_number,
          drawn_at             = rc.drawn_at,
          cadastros_encerrados = coalesce(rc.is_locked, false)
      from public.raffle_config rc
      where e.is_active;
  end if;
end $$;

-- =====================================================================
-- 6) last_number da Edição 1 = maior número existente nela
-- =====================================================================
update public.editions e
  set last_number = coalesce(
    (select max(rn.number) from public.raffle_numbers rn where rn.edition_id = e.id),
    0
  )
  where e.is_active;

-- =====================================================================
-- 7) NOT NULL + índices por edição
-- =====================================================================
alter table public.participants   alter column edition_id set not null;
alter table public.raffle_numbers alter column edition_id set not null;

create index if not exists participants_edition_idx   on public.participants (edition_id);
create index if not exists raffle_numbers_edition_idx on public.raffle_numbers (edition_id);

-- =====================================================================
-- 8) Unicidade global -> composta por edição
-- =====================================================================
alter table public.participants   drop constraint if exists participants_phone_key;
alter table public.participants   drop constraint if exists participants_referral_code_key;
alter table public.raffle_numbers drop constraint if exists raffle_numbers_number_key;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'participants_edition_phone_key') then
    alter table public.participants
      add constraint participants_edition_phone_key unique (edition_id, phone);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'participants_edition_refcode_key') then
    alter table public.participants
      add constraint participants_edition_refcode_key unique (edition_id, referral_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'raffle_numbers_edition_number_key') then
    alter table public.raffle_numbers
      add constraint raffle_numbers_edition_number_key unique (edition_id, number);
  end if;
end $$;

-- =====================================================================
-- 9) RPCs
-- =====================================================================

-- 9.1) register_participant — resolve edição ativa, numeração por edição
create or replace function public.register_participant(
  p_name text,
  p_phone text,
  p_ref_code text default null
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition       uuid;
  v_locked        boolean;
  v_referrer      uuid;
  v_existing      uuid;
  v_participant   uuid;
  v_referral_code text;
  v_count         integer;
  v_top           integer;
  v_next          integer;
  v_new_number    integer;
  i               integer;
begin
  -- Edição ativa
  select id, cadastros_encerrados into v_edition, v_locked
  from public.editions where is_active limit 1;

  if v_edition is null then
    return json_build_object('error','locked','message','Nenhuma edição ativa.');
  end if;
  if v_locked then
    return json_build_object('error','locked','message','Cadastros encerrados.');
  end if;

  -- Duplicidade POR edição
  select id into v_existing
  from public.participants
  where edition_id = v_edition and phone = p_phone;
  if v_existing is not null then
    return json_build_object('error','duplicate','message','Telefone já cadastrado.','phone',p_phone);
  end if;

  -- Referrer POR edição (silencioso se inválido)
  if p_ref_code is not null and length(p_ref_code) > 0 then
    select id into v_referrer
    from public.participants
    where edition_id = v_edition and referral_code = p_ref_code;
  end if;

  -- Código de indicação único DENTRO da edição
  loop
    v_referral_code := substr(replace(gen_random_uuid()::text,'-',''),1,8);
    exit when not exists (
      select 1 from public.participants
      where edition_id = v_edition and referral_code = v_referral_code
    );
  end loop;

  -- Reserva bloco de numeração (atômico: o UPDATE trava a linha da edição)
  v_count := 1 + (case when v_referrer is not null then 5 else 0 end);
  update public.editions
    set last_number = last_number + v_count
    where id = v_edition
    returning last_number into v_top;
  v_next := v_top - v_count + 1;  -- primeiro número reservado

  -- Participante + 1º número
  v_new_number := v_next;
  insert into public.participants (name, phone, referral_code, referred_by, edition_id)
  values (p_name, p_phone, v_referral_code, v_referrer, v_edition)
  returning id into v_participant;

  insert into public.raffle_numbers (participant_id, number, origin, edition_id)
  values (v_participant, v_new_number, 'cadastro', v_edition);

  update public.participants
    set raffle_numbers = array_append(raffle_numbers, v_new_number)
    where id = v_participant;

  -- Bônus do referrer: +5 números (dentro da mesma edição)
  if v_referrer is not null then
    for i in 1..5 loop
      v_new_number := v_next + i;
      insert into public.raffle_numbers (participant_id, number, origin, source_participant_id, edition_id)
      values (v_referrer, v_new_number, 'indicacao', v_participant, v_edition);

      update public.participants
        set raffle_numbers = array_append(raffle_numbers, v_new_number)
        where id = v_referrer;
    end loop;
  end if;

  return json_build_object(
    'ok', true,
    'participant_id', v_participant,
    'referral_code', v_referral_code,
    'phone', p_phone,
    'edition_id', v_edition
  );
end;
$$;

-- 9.2) save_winner — agora por edição (dropa a assinatura antiga)
drop function if exists public.save_winner(integer);

create or replace function public.save_winner(p_edition_id uuid, p_winner integer)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.editions
    set winner_number = p_winner, drawn_at = now()
    where id = p_edition_id;
  if not found then
    return json_build_object('error','not_found','message','Edição não encontrada.');
  end if;
  return json_build_object('ok', true, 'winner', p_winner, 'edition_id', p_edition_id);
end;
$$;

revoke execute on function public.save_winner(uuid, integer) from public;
revoke execute on function public.save_winner(uuid, integer) from anon;
revoke execute on function public.save_winner(uuid, integer) from authenticated;
grant  execute on function public.save_winner(uuid, integer) to service_role;

-- 9.3) create_edition — encerra a ativa e cria a nova como ativa
create or replace function public.create_edition(p_name text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return json_build_object('error','validation','message','Nome obrigatório.');
  end if;

  update public.editions
    set is_active = false, cadastros_encerrados = true, closed_at = now()
    where is_active;

  insert into public.editions (name, is_active, cadastros_encerrados, last_number)
  values (trim(p_name), true, false, 0)
  returning id into v_id;

  return json_build_object('ok', true, 'edition_id', v_id);
end;
$$;

revoke execute on function public.create_edition(text) from public;
revoke execute on function public.create_edition(text) from anon;
revoke execute on function public.create_edition(text) from authenticated;
grant  execute on function public.create_edition(text) to service_role;

-- 9.4) set_registration_lock — encerra/reabre cadastros de uma edição
create or replace function public.set_registration_lock(p_edition_id uuid, p_locked boolean)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.editions
    set cadastros_encerrados = p_locked
    where id = p_edition_id;
  if not found then
    return json_build_object('error','not_found','message','Edição não encontrada.');
  end if;
  return json_build_object('ok', true, 'edition_id', p_edition_id, 'cadastros_encerrados', p_locked);
end;
$$;

revoke execute on function public.set_registration_lock(uuid, boolean) from public;
revoke execute on function public.set_registration_lock(uuid, boolean) from anon;
revoke execute on function public.set_registration_lock(uuid, boolean) from authenticated;
grant  execute on function public.set_registration_lock(uuid, boolean) to service_role;

-- =====================================================================
-- 10) View com edition_id
-- =====================================================================
drop view if exists public.participants_with_stats;
create view public.participants_with_stats as
select
  p.id,
  p.name,
  p.phone,
  p.raffle_numbers,
  p.referral_code,
  p.referred_by,
  p.created_at,
  p.edition_id,
  coalesce(
    (select count(*) from public.participants pp where pp.referred_by = p.id),
    0
  )::int as referral_count,
  (select pr.name from public.participants pr where pr.id = p.referred_by)
    as referrer_name
from public.participants p;

alter view public.participants_with_stats set (security_invoker = true);

-- =====================================================================
-- 11) Aposenta o modelo global antigo
-- =====================================================================
drop sequence if exists public.raffle_number_seq;
drop table if exists public.raffle_config;
