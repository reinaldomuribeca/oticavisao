-- 0006_multi_winners.sql — múltiplos sorteios por edição, sem repetir ganhador
-- Aplicar no SQL Editor do Supabase. Migração FORWARD.
-- Idempotente onde possível (create ... if not exists / create or replace).

-- =====================================================================
-- 1) Quantidade de sorteios (prêmios) configurável por edição
-- =====================================================================
alter table public.editions
  add column if not exists total_draws integer not null default 1;

-- =====================================================================
-- 2) Tabela de ganhadores — um registro por prêmio sorteado
--    unique(edition_id, participant_id) garante, no banco, que o mesmo
--    ganhador não seja sorteado duas vezes na mesma edição.
-- =====================================================================
create table if not exists public.raffle_winners (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references public.editions(id) on delete cascade,
  position       integer not null,            -- 1º, 2º, 3º prêmio...
  number         integer not null,            -- número sorteado
  participant_id uuid not null references public.participants(id) on delete cascade,
  drawn_at       timestamptz not null default now(),
  unique (edition_id, position),
  unique (edition_id, number),
  unique (edition_id, participant_id)          -- impede o mesmo ganhador 2x
);

create index if not exists raffle_winners_edition_idx
  on public.raffle_winners (edition_id, position);

alter table public.raffle_winners enable row level security;
-- Sem policies: acesso somente pelo backend (service role).

-- =====================================================================
-- 3) Backfill: se a edição já tinha um winner_number (modelo antigo),
--    ele vira o 1º ganhador registrado.
-- =====================================================================
insert into public.raffle_winners (edition_id, position, number, participant_id, drawn_at)
select e.id, 1, e.winner_number, rn.participant_id, coalesce(e.drawn_at, now())
from public.editions e
join public.raffle_numbers rn
  on rn.edition_id = e.id and rn.number = e.winner_number
where e.winner_number is not null
  and not exists (
    select 1 from public.raffle_winners w where w.edition_id = e.id
  );

-- =====================================================================
-- 4) RPC: draw_next_winner — sorteia o PRÓXIMO ganhador.
--    Aleatório e honesto: a seleção acontece no servidor (order by random),
--    não no navegador. Exclui participantes que já ganharam nesta edição
--    e grava o resultado de forma atômica.
-- =====================================================================
create or replace function public.draw_next_winner(p_edition_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total    integer;
  v_drawn    integer;
  v_number   integer;
  v_pid      uuid;
  v_position integer;
  v_name     text;
  v_phone    text;
begin
  select total_draws into v_total from public.editions where id = p_edition_id;
  if not found then
    return json_build_object('error','not_found','message','Edição não encontrada.');
  end if;
  v_total := greatest(coalesce(v_total, 1), 1);

  select count(*) into v_drawn from public.raffle_winners where edition_id = p_edition_id;
  if v_drawn >= v_total then
    return json_build_object('error','completed','message','Todos os sorteios já foram realizados.');
  end if;

  -- Seleciona um número elegível ao acaso, excluindo quem já ganhou.
  select rn.number, rn.participant_id
    into v_number, v_pid
  from public.raffle_numbers rn
  where rn.edition_id = p_edition_id
    and rn.participant_id not in (
      select participant_id from public.raffle_winners where edition_id = p_edition_id
    )
  order by random()
  limit 1;

  if v_number is null then
    return json_build_object('error','exhausted','message','Não há participantes elegíveis restantes.');
  end if;

  v_position := v_drawn + 1;

  insert into public.raffle_winners (edition_id, position, number, participant_id)
  values (p_edition_id, v_position, v_number, v_pid);

  -- Mantém os campos legados coerentes (exibições que ainda leem o 1º prêmio).
  update public.editions
    set winner_number = coalesce(winner_number, v_number),
        drawn_at      = coalesce(drawn_at, now())
    where id = p_edition_id;

  select name, phone into v_name, v_phone
  from public.participants where id = v_pid;

  return json_build_object(
    'ok', true,
    'number', v_number,
    'name', v_name,
    'phone', v_phone,
    'position', v_position,
    'total', v_total,
    'done', v_position >= v_total
  );
end;
$$;

revoke execute on function public.draw_next_winner(uuid) from public;
revoke execute on function public.draw_next_winner(uuid) from anon;
revoke execute on function public.draw_next_winner(uuid) from authenticated;
grant  execute on function public.draw_next_winner(uuid) to service_role;

-- =====================================================================
-- 5) RPC: reset_winners — zera os ganhadores da edição (para testes).
-- =====================================================================
create or replace function public.reset_winners(p_edition_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.raffle_winners where edition_id = p_edition_id;
  get diagnostics v_count = row_count;
  update public.editions
    set winner_number = null, drawn_at = null
    where id = p_edition_id;
  return json_build_object('ok', true, 'deleted', v_count);
end;
$$;

revoke execute on function public.reset_winners(uuid) from public;
revoke execute on function public.reset_winners(uuid) from anon;
revoke execute on function public.reset_winners(uuid) from authenticated;
grant  execute on function public.reset_winners(uuid) to service_role;
