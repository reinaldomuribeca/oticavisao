-- Sorteio Ótica Visão — schema inicial
-- Roda no Supabase SQL Editor (ou via supabase CLI: `supabase db push`)

create extension if not exists pgcrypto;

-- =========================================================
-- Tabelas
-- =========================================================
create table if not exists public.participants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text not null unique,
  raffle_numbers  integer[] not null default '{}',
  referral_code   text not null unique,
  referred_by     uuid references public.participants(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists participants_referred_by_idx on public.participants (referred_by);
create index if not exists participants_created_at_idx  on public.participants (created_at desc);

create table if not exists public.raffle_numbers (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  number         integer not null unique,
  origin         text not null check (origin in ('cadastro','indicacao')),
  created_at     timestamptz not null default now()
);

create index if not exists raffle_numbers_participant_idx on public.raffle_numbers (participant_id);
create index if not exists raffle_numbers_number_idx      on public.raffle_numbers (number);

create table if not exists public.raffle_config (
  id            uuid primary key default gen_random_uuid(),
  winner_number integer,
  drawn_at      timestamptz,
  is_locked     boolean not null default false
);

-- Garante exatamente uma linha de configuração (singleton)
insert into public.raffle_config (id)
select gen_random_uuid()
where not exists (select 1 from public.raffle_config);

-- Sequence para os números do sorteio (começa em 1, sequencial global)
create sequence if not exists public.raffle_number_seq start with 1 increment by 1;

-- =========================================================
-- RPC: register_participant
--   Atômico: cria participante, atribui 1 número de cadastro,
--   se houver referrer válido, atribui +5 números a ele.
--   Bloqueia se raffle_config.is_locked = true.
-- =========================================================
create or replace function public.register_participant(
  p_name text,
  p_phone text,
  p_ref_code text default null
) returns json
language plpgsql
security definer
as $$
declare
  v_locked        boolean;
  v_referrer      uuid;
  v_existing      uuid;
  v_participant   uuid;
  v_referral_code text;
  v_new_number    integer;
  i               integer;
begin
  -- 1) Sorteio bloqueado?
  select is_locked into v_locked from public.raffle_config limit 1;
  if v_locked then
    return json_build_object('error','locked','message','Cadastros encerrados.');
  end if;

  -- 2) Telefone já existe?
  select id into v_existing from public.participants where phone = p_phone;
  if v_existing is not null then
    return json_build_object('error','duplicate','message','Telefone já cadastrado.','phone',p_phone);
  end if;

  -- 3) Resolve referrer (silencioso se inválido)
  if p_ref_code is not null and length(p_ref_code) > 0 then
    select id into v_referrer
    from public.participants
    where referral_code = p_ref_code;
  end if;

  -- 4) Gera código de indicação único (8 chars do uuid; retry se colidir)
  loop
    v_referral_code := substr(replace(gen_random_uuid()::text,'-',''),1,8);
    exit when not exists (select 1 from public.participants where referral_code = v_referral_code);
  end loop;

  -- 5) Insere participante
  insert into public.participants (name, phone, referral_code, referred_by)
  values (p_name, p_phone, v_referral_code, v_referrer)
  returning id into v_participant;

  -- 6) Atribui 1 número de cadastro
  v_new_number := nextval('public.raffle_number_seq');
  insert into public.raffle_numbers (participant_id, number, origin)
  values (v_participant, v_new_number, 'cadastro');

  update public.participants
    set raffle_numbers = array_append(raffle_numbers, v_new_number)
    where id = v_participant;

  -- 7) Bônus: +5 números para o referrer
  if v_referrer is not null then
    for i in 1..5 loop
      v_new_number := nextval('public.raffle_number_seq');
      insert into public.raffle_numbers (participant_id, number, origin)
      values (v_referrer, v_new_number, 'indicacao');

      update public.participants
        set raffle_numbers = array_append(raffle_numbers, v_new_number)
        where id = v_referrer;
    end loop;
  end if;

  return json_build_object(
    'ok', true,
    'participant_id', v_participant,
    'referral_code', v_referral_code,
    'phone', p_phone
  );
end;
$$;

-- =========================================================
-- RPC: save_winner
--   Persiste o número vencedor. Idempotente.
-- =========================================================
create or replace function public.save_winner(p_winner integer)
returns json
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.raffle_config limit 1;
  update public.raffle_config
    set winner_number = p_winner,
        drawn_at      = now()
    where id = v_id;
  return json_build_object('ok', true, 'winner', p_winner);
end;
$$;

-- =========================================================
-- View: participants_with_stats
--   Adiciona referral_count e referrer_name. Simplifica admin/me.
-- =========================================================
create or replace view public.participants_with_stats as
select
  p.id,
  p.name,
  p.phone,
  p.raffle_numbers,
  p.referral_code,
  p.referred_by,
  p.created_at,
  coalesce(
    (select count(*) from public.participants pp where pp.referred_by = p.id),
    0
  )::int as referral_count,
  (select pr.name from public.participants pr where pr.id = p.referred_by)
    as referrer_name
from public.participants p;

-- =========================================================
-- RLS — habilitamos, mas todas as escritas/leituras sensíveis
-- passam pelo backend (service role), então as policies aqui
-- só liberam SELECTs públicos mínimos.
-- =========================================================
alter table public.participants    enable row level security;
alter table public.raffle_numbers  enable row level security;
alter table public.raffle_config   enable row level security;

-- Sem policies = nenhum acesso anônimo direto. O backend usa SERVICE ROLE.
-- Se quiser liberar leitura pública do número vencedor, descomente:
-- create policy "raffle_config readable" on public.raffle_config
--   for select using (true);
