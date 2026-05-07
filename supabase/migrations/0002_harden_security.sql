-- Sorteio Ótica Visão — hardening de segurança
-- Resolve avisos do Supabase advisor:
--   * function_search_path_mutable (register_participant, save_winner)
--   * security_definer_view (participants_with_stats)
--   * anon/authenticated_security_definer_function_executable (save_winner)
--
-- Idempotente: pode ser re-executada sem efeito colateral.

-- 1) Fixar search_path nas RPCs SECURITY DEFINER
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
  v_locked        boolean;
  v_referrer      uuid;
  v_existing      uuid;
  v_participant   uuid;
  v_referral_code text;
  v_new_number    integer;
  i               integer;
begin
  select is_locked into v_locked from public.raffle_config limit 1;
  if v_locked then
    return json_build_object('error','locked','message','Cadastros encerrados.');
  end if;

  select id into v_existing from public.participants where phone = p_phone;
  if v_existing is not null then
    return json_build_object('error','duplicate','message','Telefone já cadastrado.','phone',p_phone);
  end if;

  if p_ref_code is not null and length(p_ref_code) > 0 then
    select id into v_referrer
    from public.participants
    where referral_code = p_ref_code;
  end if;

  loop
    v_referral_code := substr(replace(gen_random_uuid()::text,'-',''),1,8);
    exit when not exists (select 1 from public.participants where referral_code = v_referral_code);
  end loop;

  insert into public.participants (name, phone, referral_code, referred_by)
  values (p_name, p_phone, v_referral_code, v_referrer)
  returning id into v_participant;

  v_new_number := nextval('public.raffle_number_seq');
  insert into public.raffle_numbers (participant_id, number, origin)
  values (v_participant, v_new_number, 'cadastro');

  update public.participants
    set raffle_numbers = array_append(raffle_numbers, v_new_number)
    where id = v_participant;

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

create or replace function public.save_winner(p_winner integer)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
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

-- 2) save_winner: só backend (service_role). Revoga de anon/authenticated/public.
revoke execute on function public.save_winner(integer) from public;
revoke execute on function public.save_winner(integer) from anon;
revoke execute on function public.save_winner(integer) from authenticated;
grant  execute on function public.save_winner(integer) to service_role;

-- 3) View com security_invoker (avalia RLS do chamador, não do criador)
alter view public.participants_with_stats set (security_invoker = true);
