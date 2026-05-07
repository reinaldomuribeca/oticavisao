-- Adiciona rastreamento de qual participante originou os bônus de indicação
alter table public.raffle_numbers
  add column if not exists source_participant_id uuid
    references public.participants(id) on delete set null;

create index if not exists raffle_numbers_source_idx
  on public.raffle_numbers (source_participant_id)
  where source_participant_id is not null;

-- Atualiza register_participant para gravar source_participant_id nos bônus
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

  -- Bônus do referrer: registra source_participant_id para rastreamento futuro
  if v_referrer is not null then
    for i in 1..5 loop
      v_new_number := nextval('public.raffle_number_seq');
      insert into public.raffle_numbers (participant_id, number, origin, source_participant_id)
      values (v_referrer, v_new_number, 'indicacao', v_participant);

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

-- RPC: delete_participant
-- Apaga um participante e reverte os bônus de indicação que ele gerou para seu referrer.
create or replace function public.delete_participant(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referrer_id   uuid;
  v_bonus_numbers integer[];
begin
  select referred_by into v_referrer_id
  from public.participants
  where id = p_id;

  if not found then
    return json_build_object('error','not_found','message','Participante não encontrado.');
  end if;

  -- Se havia referrer, reverte os números de bônus gerados por este participante
  if v_referrer_id is not null then
    select array_agg(number) into v_bonus_numbers
    from public.raffle_numbers
    where source_participant_id = p_id;

    if v_bonus_numbers is not null then
      update public.participants
        set raffle_numbers = array(
          select n from unnest(raffle_numbers) as n
          where n <> all(v_bonus_numbers)
        )
        where id = v_referrer_id;

      delete from public.raffle_numbers
        where source_participant_id = p_id;
    end if;
  end if;

  -- Apaga o participante (CASCADE remove seus próprios raffle_numbers)
  delete from public.participants where id = p_id;

  return json_build_object('ok', true);
end;
$$;

-- Restringe delete_participant ao service_role (backend apenas)
revoke execute on function public.delete_participant(uuid) from public;
revoke execute on function public.delete_participant(uuid) from anon;
revoke execute on function public.delete_participant(uuid) from authenticated;
grant  execute on function public.delete_participant(uuid) to service_role;
