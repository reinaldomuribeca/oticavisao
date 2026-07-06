-- 0005_edition_raffle_date.sql — data/hora do sorteio por edição
-- Aplicar no SQL Editor do Supabase. Migração FORWARD.
-- Idempotente onde possível (create or replace / add column if not exists).

-- =====================================================================
-- 1) Coluna raffle_date na edição
-- =====================================================================
alter table public.editions
  add column if not exists raffle_date timestamptz;

-- =====================================================================
-- 2) create_edition passa a receber a data do sorteio (param opcional)
--    Recria com a nova assinatura e dropa a antiga (evita overload ambíguo).
-- =====================================================================
create or replace function public.create_edition(
  p_name text,
  p_raffle_date timestamptz default null
)
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

  insert into public.editions (name, is_active, cadastros_encerrados, last_number, raffle_date)
  values (trim(p_name), true, false, 0, p_raffle_date)
  returning id into v_id;

  return json_build_object('ok', true, 'edition_id', v_id);
end;
$$;

-- Remove a assinatura antiga de 1 argumento para não haver overload ambíguo.
drop function if exists public.create_edition(text);

revoke execute on function public.create_edition(text, timestamptz) from public;
revoke execute on function public.create_edition(text, timestamptz) from anon;
revoke execute on function public.create_edition(text, timestamptz) from authenticated;
grant  execute on function public.create_edition(text, timestamptz) to service_role;

-- =====================================================================
-- 3) set_edition_date — define/altera a data de uma edição (inclusive a Edição 1)
-- =====================================================================
create or replace function public.set_edition_date(
  p_edition_id uuid,
  p_raffle_date timestamptz
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.editions
    set raffle_date = p_raffle_date
    where id = p_edition_id;
  if not found then
    return json_build_object('error','not_found','message','Edição não encontrada.');
  end if;
  return json_build_object('ok', true, 'edition_id', p_edition_id, 'raffle_date', p_raffle_date);
end;
$$;

revoke execute on function public.set_edition_date(uuid, timestamptz) from public;
revoke execute on function public.set_edition_date(uuid, timestamptz) from anon;
revoke execute on function public.set_edition_date(uuid, timestamptz) from authenticated;
grant  execute on function public.set_edition_date(uuid, timestamptz) to service_role;
