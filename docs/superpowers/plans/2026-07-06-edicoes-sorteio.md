# Edições de Sorteio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolar cada live/sorteio em uma "edição": criar edições, encerrar a antiga e iniciar a nova, de forma que participantes, números e o sorteio nunca se misturem entre edições.

**Architecture:** Multi-tenancy leve por coluna `edition_id` em `participants` e `raffle_numbers`; nova tabela `editions` substitui o singleton `raffle_config` como fonte do estado de cada sorteio (ativa, cadastros encerrados, contador de numeração, vencedor). O backend resolve a edição ativa; o front público não muda. Admin e sorteador filtram por edição.

**Tech Stack:** Next.js 14 (App Router, Route Handlers), TypeScript, Supabase/Postgres (PL/pgSQL RPCs, service role), Tailwind + shadcn-style UI.

## Global Constraints

- **Numeração reinicia em #1 por edição** — `UNIQUE(edition_id, number)`, contador `editions.last_number`.
- **Telefone único por edição** — `UNIQUE(edition_id, phone)`; mesmo telefone pode recadastrar em edição nova.
- **Indicações reiniciam por edição** — referral resolve só dentro da edição ativa; `UNIQUE(edition_id, referral_code)`.
- **No máximo uma edição ativa** — índice único parcial `on editions (is_active) where is_active`.
- **Todo acesso ao banco passa pelo backend (service role).** RPCs sensíveis restritas a `service_role`.
- **Migrações aplicadas manualmente no SQL Editor do Supabase** (não há CLI/CI de migração).
- Todas as rotas admin já são protegidas por `middleware.ts` (`/api/admin/:path*`, `/api/raffle/:path*`) + `isAdminAuthed()`.
- Sem framework de testes no projeto — a verificação é por: `npm run build` (typecheck), queries SQL de asserção, `curl`/navegador.

## File Structure

- `supabase/migrations/0004_editions.sql` **(criar)** — schema `editions`, `edition_id`, backfill, constraints, RPCs, view, drops.
- `lib/editions.ts` **(criar)** — helpers `getActiveEdition`, `resolveEditionId` + type `Edition`.
- `lib/supabase.ts` **(modificar)** — `edition_id` em `Participant`; re-export de `Edition`.
- `app/api/admin/editions/route.ts` **(criar)** — GET lista, POST cria edição.
- `app/api/admin/editions/[id]/route.ts` **(criar)** — PATCH encerra/reabre cadastros.
- `app/api/admin/{leads,stats,export}/route.ts` **(modificar)** — filtrar por edição.
- `app/api/raffle/route.ts`, `app/api/raffle/lookup/route.ts` **(modificar)** — pool/vencedor/lookup por edição.
- `app/api/participants/{me,referrer}/route.ts` **(modificar)** — escopar na edição ativa.
- `app/admin/Dashboard.tsx` **(modificar)** — seletor de edição, botões nova/encerrar, badge.
- `app/admin/sorteio/Sorteador.tsx` **(modificar)** — usar edição (param), exibir nome.

---

## Task 0: Pré-condição operacional (sem código)

**Antes de aplicar a migration (Task 2):**

- [ ] **Passo 1: Backup dos dados atuais.** No Supabase Dashboard → Database → Backups (ou exportar via `/api/admin/export` logado no admin) para guardar os cadastros atuais antes de mexer no schema.
- [ ] **Passo 2: Escolher a janela.** A migration transforma tudo que existe hoje na "Edição 1" (ativa). Aplicar quando não houver cadastros acontecendo ao vivo (para não perder inserts durante o `alter table`).
- [ ] **Passo 3: Confirmar com o dono** que pode aplicar no banco de produção `sbcvaisqxrxwbcgdrztf`.

---

## Task 1: Escrever a migration `0004_editions.sql`

Autoria do arquivo SQL completo. Não aplica no banco ainda (isso é a Task 2) — separa a revisão do SQL do momento em que ele toca produção.

**Files:**
- Create: `supabase/migrations/0004_editions.sql`

**Interfaces (produzidas para as tasks seguintes):**
- Tabela `public.editions(id uuid, name text, is_active bool, cadastros_encerrados bool, last_number int, winner_number int, drawn_at timestamptz, created_at timestamptz, closed_at timestamptz)`.
- Colunas `participants.edition_id uuid not null`, `raffle_numbers.edition_id uuid not null`.
- RPCs: `register_participant(p_name text, p_phone text, p_ref_code text)` (assinatura inalterada), `save_winner(p_edition_id uuid, p_winner integer)`, `create_edition(p_name text)`, `set_registration_lock(p_edition_id uuid, p_locked boolean)`.
- View `participants_with_stats` agora inclui `edition_id`.

- [ ] **Step 1: Criar o arquivo com todo o conteúdo abaixo**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_editions.sql
git commit -m "feat(db): migration de edições (schema, RPCs, backfill)"
```

---

## Task 2: Aplicar a migration e verificar no banco

Passo que efetivamente muda o banco de produção. Gate explícito.

**Files:** nenhum (execução SQL no Supabase).

- [ ] **Step 1: Aplicar** — abrir o Supabase SQL Editor do projeto `sbcvaisqxrxwbcgdrztf`, colar o conteúdo de `supabase/migrations/0004_editions.sql` e rodar. Esperado: sucesso sem erro.

- [ ] **Step 2: Verificar backfill e schema** — rodar:

```sql
-- (a) Uma edição, ativa, "Edição 1"
select id, name, is_active, cadastros_encerrados, last_number, winner_number
from public.editions;

-- (b) Nenhum participante/número sem edição
select count(*) as participants_sem_edicao from public.participants where edition_id is null;   -- espera 0
select count(*) as numbers_sem_edicao      from public.raffle_numbers where edition_id is null;  -- espera 0

-- (c) last_number bate com o maior número da edição
select e.last_number,
       (select max(number) from public.raffle_numbers rn where rn.edition_id = e.id) as max_num
from public.editions e where e.is_active;                                             -- last_number == max_num

-- (d) Constraints compostas existem; globais sumiram
select conname from pg_constraint
where conname in ('participants_edition_phone_key','participants_edition_refcode_key',
                  'raffle_numbers_edition_number_key','participants_phone_key','raffle_numbers_number_key');
-- espera as 3 compostas; NÃO deve aparecer participants_phone_key nem raffle_numbers_number_key

-- (e) Legado removido
select to_regclass('public.raffle_config') as raffle_config,
       to_regclass('public.raffle_number_seq') as seq;                                -- ambos null
```

- [ ] **Step 3: Smoke test das RPCs novas (com rollback, sem sujar produção)**

```sql
begin;
  select public.create_edition('Teste Rollback');
  -- deve haver 2 edições, a nova ativa e a antiga encerrada:
  select name, is_active, cadastros_encerrados from public.editions order by created_at;
  select public.set_registration_lock((select id from public.editions where is_active), true);
rollback;
-- Após rollback: volta a existir só a "Edição 1" ativa.
select name, is_active from public.editions;
```

Esperado: dentro da transação, 2 edições (nova ativa, antiga encerrada); após `rollback`, só "Edição 1" ativa.

---

## Task 3: Helper de edição + tipos

**Files:**
- Create: `lib/editions.ts`
- Modify: `lib/supabase.ts`

**Interfaces:**
- Produces: `getActiveEdition(supabase): Promise<Edition | null>`, `resolveEditionId(supabase, param: string | null): Promise<string | null>`, `type Edition`.
- Consumes: `SupabaseClient` de `@supabase/supabase-js`.

- [ ] **Step 1: Criar `lib/editions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Edition = {
  id: string;
  name: string;
  is_active: boolean;
  cadastros_encerrados: boolean;
  last_number: number;
  winner_number: number | null;
  drawn_at: string | null;
  created_at: string;
  closed_at: string | null;
};

/** Retorna a edição ativa (ou null se não houver nenhuma). */
export async function getActiveEdition(
  supabase: SupabaseClient,
): Promise<Edition | null> {
  const { data } = await supabase
    .from("editions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

/**
 * Resolve qual edição usar: se `param` for o id de uma edição existente, usa-o;
 * caso contrário cai para a edição ativa. Retorna o id ou null se não houver
 * nenhuma edição.
 */
export async function resolveEditionId(
  supabase: SupabaseClient,
  param: string | null,
): Promise<string | null> {
  if (param) {
    const { data } = await supabase
      .from("editions")
      .select("id")
      .eq("id", param)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const active = await getActiveEdition(supabase);
  return active?.id ?? null;
}
```

- [ ] **Step 2: Adicionar `edition_id` ao type `Participant` em `lib/supabase.ts`**

Substituir o type `Participant` (linhas 35-43) por:

```ts
export type Participant = {
  id: string;
  name: string;
  phone: string;
  raffle_numbers: number[];
  referral_code: string;
  referred_by: string | null;
  edition_id: string;
  created_at: string;
};
```

E adicionar, logo após o type `Participant`:

```ts
export type { Edition } from "@/lib/editions";
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build`
Expected: build passa (sem erros de TypeScript).

- [ ] **Step 4: Commit**

```bash
git add lib/editions.ts lib/supabase.ts
git commit -m "feat: helper de edição (getActiveEdition/resolveEditionId) + tipos"
```

---

## Task 4: APIs admin de edições (listar / criar / encerrar)

**Files:**
- Create: `app/api/admin/editions/route.ts`
- Create: `app/api/admin/editions/[id]/route.ts`

**Interfaces:**
- Produces: `GET /api/admin/editions` → `{ ok, editions: Edition[] }`; `POST /api/admin/editions {name}` → `{ ok, edition_id }`; `PATCH /api/admin/editions/[id] {cadastros_encerrados}` → `{ ok, edition_id, cadastros_encerrados }`.
- Consumes: RPCs `create_edition`, `set_registration_lock` (Task 1); `isAdminAuthed`, `getServiceSupabase`.

- [ ] **Step 1: Criar `app/api/admin/editions/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — lista todas as edições (mais recente primeiro)
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("editions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, editions: data ?? [] });
}

// POST { name } — cria nova edição (encerra a ativa atual)
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").toString().trim();
  if (name.length < 1) {
    return NextResponse.json({ error: "validation", message: "Nome obrigatório." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("create_edition", { p_name: name });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}
```

- [ ] **Step 2: Criar `app/api/admin/editions/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH { cadastros_encerrados: boolean } — encerra/reabre cadastros da edição
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { cadastros_encerrados?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.cadastros_encerrados !== "boolean") {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("set_registration_lock", {
    p_edition_id: params.id,
    p_locked: body.cadastros_encerrados,
  });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    return NextResponse.json(payload, { status: 404 });
  }
  return NextResponse.json(payload);
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 4: Verificar em runtime (dev server logado no admin)**

Run: `npm run dev` e, num navegador já autenticado no `/admin`, no console:

```js
await fetch("/api/admin/editions").then(r => r.json())
```

Expected: `{ ok: true, editions: [{ name: "Edição 1", is_active: true, ... }] }`.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/editions
git commit -m "feat(api): rotas admin de edições (listar/criar/encerrar cadastros)"
```

---

## Task 5: Escopar rotas admin de leitura por edição

**Files:**
- Modify: `app/api/admin/leads/route.ts`
- Modify: `app/api/admin/stats/route.ts`
- Modify: `app/api/admin/export/route.ts`

**Interfaces:**
- Consumes: `resolveEditionId` (Task 3).
- Produces: `GET /api/admin/stats?edition=` agora retorna `{ ok, stats, edition }` (o campo `config` some, vira `edition`).

- [ ] **Step 1: `leads/route.ts` — resolver e filtrar por edição**

Adicionar o import no topo (após a linha `import { getServiceSupabase } ...`):

```ts
import { resolveEditionId } from "@/lib/editions";
```

Substituir o bloco que hoje é (linhas 21-26):

```ts
  const supabase = getServiceSupabase();
  const sortField = ALLOWED_SORT.has(sort) ? sort : "created_at";

  let query = supabase
    .from("participants_with_stats")
    .select("*", { count: "exact" });
```

por:

```ts
  const supabase = getServiceSupabase();
  const sortField = ALLOWED_SORT.has(sort) ? sort : "created_at";
  const editionId = await resolveEditionId(supabase, url.searchParams.get("edition"));

  if (!editionId) {
    return NextResponse.json({ ok: true, leads: [], page, pageSize: PAGE_SIZE, total: 0 });
  }

  let query = supabase
    .from("participants_with_stats")
    .select("*", { count: "exact" })
    .eq("edition_id", editionId);
```

- [ ] **Step 2: `stats/route.ts` — reescrever para escopar por edição**

Substituir o arquivo inteiro por:

```ts
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const url = new URL(req.url);
  const editionId = await resolveEditionId(supabase, url.searchParams.get("edition"));

  if (!editionId) {
    return NextResponse.json({
      ok: true,
      stats: { participants: 0, numbers: 0, referrals: 0, top: null },
      edition: null,
    });
  }

  const [participantsCount, numbersCount, referralCount, top, edition] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId),
      supabase
        .from("raffle_numbers")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId),
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId)
        .not("referred_by", "is", null),
      supabase
        .from("participants_with_stats")
        .select("id,name,phone,referral_count")
        .eq("edition_id", editionId)
        .order("referral_count", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("editions").select("*").eq("id", editionId).maybeSingle(),
    ]);

  return NextResponse.json({
    ok: true,
    stats: {
      participants: participantsCount.count ?? 0,
      numbers: numbersCount.count ?? 0,
      referrals: referralCount.count ?? 0,
      top: top.data ?? null,
    },
    edition: edition.data ?? null,
  });
}
```

- [ ] **Step 3: `export/route.ts` — filtrar CSV por edição**

Adicionar o import (após `import { toCSV } ...`):

```ts
import { resolveEditionId } from "@/lib/editions";
```

Trocar a assinatura `export async function GET() {` por `export async function GET(req: Request) {`.

Substituir o bloco (linhas 12-16):

```ts
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("participants_with_stats")
    .select("*")
    .order("created_at", { ascending: true });
```

por:

```ts
  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, new URL(req.url).searchParams.get("edition"));

  let listQuery = supabase
    .from("participants_with_stats")
    .select("*")
    .order("created_at", { ascending: true });
  if (editionId) listQuery = listQuery.eq("edition_id", editionId);
  const { data, error } = await listQuery;
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/leads/route.ts app/api/admin/stats/route.ts app/api/admin/export/route.ts
git commit -m "feat(api): escopar leads/stats/export por edição"
```

---

## Task 6: Escopar o sorteador (pool, vencedor, lookup) por edição

**Files:**
- Modify: `app/api/raffle/route.ts`
- Modify: `app/api/raffle/lookup/route.ts`

**Interfaces:**
- Consumes: `resolveEditionId` (Task 3); RPC `save_winner(p_edition_id, p_winner)` (Task 1).
- Produces: `GET /api/raffle?edition=` → `{ ok, pool, winner, edition }`; `POST /api/raffle?edition= {number}` → `{ ok, winner }`.

- [ ] **Step 1: `raffle/route.ts` — reescrever GET e POST escopados**

Substituir o arquivo inteiro por:

```ts
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

/**
 * GET — info do sorteio da edição (pool de números, vencedor salvo, edição).
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, new URL(req.url).searchParams.get("edition"));

  if (!editionId) {
    return NextResponse.json({ ok: true, pool: [], winner: null, edition: null });
  }

  const [{ data: numbers }, { data: edition }] = await Promise.all([
    supabase
      .from("raffle_numbers")
      .select("number")
      .eq("edition_id", editionId)
      .order("number", { ascending: true }),
    supabase.from("editions").select("*").eq("id", editionId).maybeSingle(),
  ]);

  let winner: { number: number; name: string; phone: string } | null = null;
  if (edition?.winner_number != null) {
    const { data: rn } = await supabase
      .from("raffle_numbers")
      .select("participant_id")
      .eq("edition_id", editionId)
      .eq("number", edition.winner_number)
      .maybeSingle();
    if (rn?.participant_id) {
      const { data: p } = await supabase
        .from("participants")
        .select("name,phone")
        .eq("id", rn.participant_id)
        .maybeSingle();
      if (p) winner = { number: edition.winner_number, name: p.name, phone: p.phone };
    }
  }

  return NextResponse.json({
    ok: true,
    pool: (numbers ?? []).map((n) => n.number),
    winner,
    edition: edition ?? null,
  });
}

/**
 * POST { number } (?edition=) — persiste o vencedor na edição.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { number?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const number = Number(body.number);
  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "invalid_number" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, new URL(req.url).searchParams.get("edition"));
  if (!editionId) {
    return NextResponse.json({ error: "no_edition" }, { status: 400 });
  }

  const { data: rn } = await supabase
    .from("raffle_numbers")
    .select("participant_id")
    .eq("edition_id", editionId)
    .eq("number", number)
    .maybeSingle();
  if (!rn) {
    return NextResponse.json({ error: "number_not_in_pool" }, { status: 400 });
  }

  const { error } = await supabase.rpc("save_winner", {
    p_edition_id: editionId,
    p_winner: number,
  });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }

  const { data: p } = await supabase
    .from("participants")
    .select("name,phone")
    .eq("id", rn.participant_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    winner: { number, name: p?.name ?? "", phone: p?.phone ?? "" },
  });
}
```

- [ ] **Step 2: `raffle/lookup/route.ts` — escopar o lookup por edição**

Adicionar o import (após `import { getServiceSupabase } ...`):

```ts
import { resolveEditionId } from "@/lib/editions";
```

Substituir o bloco (linhas 17-23):

```ts
  const supabase = getServiceSupabase();
  const { data: rn } = await supabase
    .from("raffle_numbers")
    .select("participant_id")
    .eq("number", number)
    .maybeSingle();
  if (!rn) return NextResponse.json({ error: "not_found" }, { status: 404 });
```

por:

```ts
  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, url.searchParams.get("edition"));
  if (!editionId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: rn } = await supabase
    .from("raffle_numbers")
    .select("participant_id")
    .eq("edition_id", editionId)
    .eq("number", number)
    .maybeSingle();
  if (!rn) return NextResponse.json({ error: "not_found" }, { status: 404 });
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 4: Commit**

```bash
git add app/api/raffle/route.ts app/api/raffle/lookup/route.ts
git commit -m "feat(api): escopar pool/vencedor/lookup do sorteio por edição"
```

---

## Task 7: Escopar rotas de participante na edição ativa

**Files:**
- Modify: `app/api/participants/me/route.ts`
- Modify: `app/api/participants/referrer/route.ts`

**Interfaces:**
- Consumes: `getActiveEdition` (Task 3).

- [ ] **Step 1: `me/route.ts` — buscar o participante só na edição ativa**

Adicionar o import (após `import { getServiceSupabase } ...`):

```ts
import { getActiveEdition } from "@/lib/editions";
```

Substituir o bloco (linhas 13-19):

```ts
  const supabase = getServiceSupabase();

  const { data: participant, error } = await supabase
    .from("participants")
    .select("id, name, phone, referral_code, created_at")
    .eq("phone", phone)
    .maybeSingle();
```

por:

```ts
  const supabase = getServiceSupabase();
  const activeEdition = await getActiveEdition(supabase);
  if (!activeEdition) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: participant, error } = await supabase
    .from("participants")
    .select("id, name, phone, referral_code, created_at")
    .eq("edition_id", activeEdition.id)
    .eq("phone", phone)
    .maybeSingle();
```

- [ ] **Step 2: `referrer/route.ts` — resolver o código só na edição ativa**

Adicionar o import (após `import { getServiceSupabase } ...`):

```ts
import { getActiveEdition } from "@/lib/editions";
```

Substituir o bloco (linhas 11-17):

```ts
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("participants")
    .select("name")
    .eq("referral_code", code)
    .maybeSingle();
```

por:

```ts
  const supabase = getServiceSupabase();
  const activeEdition = await getActiveEdition(supabase);
  if (!activeEdition) return NextResponse.json({ name: null });

  const { data } = await supabase
    .from("participants")
    .select("name")
    .eq("edition_id", activeEdition.id)
    .eq("referral_code", code)
    .maybeSingle();
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 4: Commit**

```bash
git add app/api/participants/me/route.ts app/api/participants/referrer/route.ts
git commit -m "feat(api): escopar /me e /referrer na edição ativa"
```

---

## Task 8: Dashboard — seletor de edição, botões e badge

**Files:**
- Modify: `app/admin/Dashboard.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/editions`, `PATCH /api/admin/editions/[id]`, `GET /api/admin/stats?edition=`, `GET /api/admin/leads?edition=`, `GET /api/admin/export?edition=`.

- [ ] **Step 1: Import do ícone `Plus`**

Na lista de imports de `lucide-react` (linhas 17-29), adicionar `Plus` — trocar a linha `Trophy,` por:

```tsx
  Trophy,
  Plus,
```

- [ ] **Step 2: Trocar os types `Stats` (e adicionar `Edition`)**

Substituir o type `Stats` (linhas 42-55) por:

```tsx
type Edition = {
  id: string;
  name: string;
  is_active: boolean;
  cadastros_encerrados: boolean;
  last_number: number;
  winner_number: number | null;
  drawn_at: string | null;
  created_at: string;
  closed_at: string | null;
};

type Stats = {
  ok: true;
  stats: {
    participants: number;
    numbers: number;
    referrals: number;
    top: { id: string; name: string; phone: string; referral_count: number } | null;
  };
  edition: Edition | null;
};
```

- [ ] **Step 3: Trocar o estado (`config` → `edition` + estado de edições)**

Substituir a linha (74):

```tsx
  const [config, setConfig] = useState<Stats["config"]>(null);
```

por:

```tsx
  const [edition, setEdition] = useState<Edition | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<string>("");
  const [busyEdition, setBusyEdition] = useState(false);
```

- [ ] **Step 4: Trocar os effects (carregar edições, stats e leads por edição)**

Substituir os dois `useEffect` (linhas 88-112) por:

```tsx
  // Carrega a lista de edições e seleciona a ativa
  useEffect(() => {
    fetch("/api/admin/editions")
      .then((r) => r.json())
      .then((d: { editions: Edition[] }) => {
        setEditions(d.editions ?? []);
        const active = (d.editions ?? []).find((e) => e.is_active);
        setSelectedEdition((prev) => prev || active?.id || (d.editions?.[0]?.id ?? ""));
      });
  }, []);

  // Stats da edição selecionada
  useEffect(() => {
    if (!selectedEdition) return;
    fetch(`/api/admin/stats?edition=${selectedEdition}`)
      .then((r) => r.json())
      .then((d: Stats) => {
        setStats(d.stats);
        setEdition(d.edition);
      });
  }, [selectedEdition]);

  // Leads da edição selecionada
  useEffect(() => {
    if (!selectedEdition) return;
    setLoading(true);
    const url = new URL("/api/admin/leads", window.location.origin);
    url.searchParams.set("edition", selectedEdition);
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", sort);
    url.searchParams.set("dir", dir);
    if (q) url.searchParams.set("q", q);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d: LeadsResp) => {
        setLeads(d.leads);
        setTotal(d.total);
        setPageSize(d.pageSize);
      })
      .finally(() => setLoading(false));
  }, [selectedEdition, page, sort, dir, q]);
```

- [ ] **Step 5: Atualizar o refetch de stats no `handleDelete` + adicionar handlers de edição**

Substituir o bloco dentro de `handleDelete` (linhas 154-157):

```tsx
        // Recarrega stats
        fetch("/api/admin/stats")
          .then((r) => r.json())
          .then((d: Stats) => { setStats(d.stats); setConfig(d.config); });
```

por:

```tsx
        // Recarrega stats da edição atual
        if (selectedEdition) {
          fetch(`/api/admin/stats?edition=${selectedEdition}`)
            .then((r) => r.json())
            .then((d: Stats) => { setStats(d.stats); setEdition(d.edition); });
        }
```

E adicionar, logo após a função `handleDelete` (antes do `return`), os handlers:

```tsx
  function refreshEditions() {
    fetch("/api/admin/editions")
      .then((r) => r.json())
      .then((d: { editions: Edition[] }) => setEditions(d.editions ?? []));
    if (selectedEdition) {
      fetch(`/api/admin/stats?edition=${selectedEdition}`)
        .then((r) => r.json())
        .then((d: Stats) => { setStats(d.stats); setEdition(d.edition); });
    }
  }

  async function createEdition() {
    const name = window.prompt("Nome da nova edição (ex.: Live Agosto/2026):");
    if (!name || !name.trim()) return;
    setBusyEdition(true);
    try {
      const res = await fetch("/api/admin/editions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (res.ok && d.edition_id) {
        const list = await fetch("/api/admin/editions").then((r) => r.json());
        setEditions(list.editions ?? []);
        setSelectedEdition(d.edition_id);
        setPage(1);
      } else {
        window.alert(d.message ?? "Erro ao criar edição.");
      }
    } finally {
      setBusyEdition(false);
    }
  }

  async function toggleLock() {
    if (!edition) return;
    setBusyEdition(true);
    try {
      const res = await fetch(`/api/admin/editions/${edition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadastros_encerrados: !edition.cadastros_encerrados }),
      });
      if (res.ok) refreshEditions();
    } finally {
      setBusyEdition(false);
    }
  }
```

- [ ] **Step 6: Trocar o link de exportar CSV para incluir a edição**

Substituir o bloco (linhas 182-186):

```tsx
          <Button asChild variant="secondary" size="lg">
            <a href="/api/admin/export">
              <Download className="mr-2 h-4 w-4" /> EXPORTAR CSV
            </a>
          </Button>
```

por:

```tsx
          <Button asChild variant="secondary" size="lg">
            <a href={selectedEdition ? `/api/admin/export?edition=${selectedEdition}` : "/api/admin/export"}>
              <Download className="mr-2 h-4 w-4" /> EXPORTAR CSV
            </a>
          </Button>
```

- [ ] **Step 7: Inserir a barra de edição (depois de `</header>`, linha 191)**

Inserir, imediatamente após `</header>`:

```tsx
      {/* Barra de edição */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-ink-900/60 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Edição
          </span>
          <select
            value={selectedEdition}
            onChange={(e) => {
              setSelectedEdition(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-sm text-zinc-200"
          >
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.is_active ? " (ativa)" : ""}
              </option>
            ))}
          </select>
        </div>

        {edition && (
          <Badge variant={edition.is_active ? "default" : "secondary"}>
            {edition.is_active
              ? edition.cadastros_encerrados
                ? "Ativa · cadastros encerrados"
                : "Ativa · cadastros abertos"
              : "Encerrada"}
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {edition?.is_active && (
            <Button variant="secondary" size="sm" disabled={busyEdition} onClick={toggleLock}>
              {edition.cadastros_encerrados ? "Reabrir cadastros" : "Encerrar cadastros"}
            </Button>
          )}
          <Button variant="default" size="sm" disabled={busyEdition} onClick={createEdition}>
            <Plus className="mr-1 h-4 w-4" /> Nova edição
          </Button>
        </div>
      </div>
```

- [ ] **Step 8: Trocar o banner do vencedor para usar `edition`**

Substituir o bloco (linhas 193-207):

```tsx
      {config?.winner_number != null && (
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            🏆 Sorteio realizado
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-100">
            Número vencedor: #{String(config.winner_number).padStart(3, "0")}
          </p>
          {config.drawn_at && (
            <p className="text-xs text-emerald-300/80">
              {new Date(config.drawn_at).toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
      )}
```

por:

```tsx
      {edition?.winner_number != null && (
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            🏆 Sorteio realizado — {edition.name}
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-100">
            Número vencedor: #{String(edition.winner_number).padStart(3, "0")}
          </p>
          {edition.drawn_at && (
            <p className="text-xs text-emerald-300/80">
              {new Date(edition.drawn_at).toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
      )}
```

- [ ] **Step 9: Verificar typecheck**

Run: `npm run build`
Expected: build passa (nenhuma referência remanescente a `config`/`setConfig`).

- [ ] **Step 10: Verificar no navegador**

Run: `npm run dev`, abrir `/admin` autenticado. Esperado: barra de edição com "Edição 1 (ativa)", badge "Ativa · cadastros abertos", botões "Encerrar cadastros" e "Nova edição". Trocar de edição no seletor recarrega cards/leads.

- [ ] **Step 11: Commit**

```bash
git add app/admin/Dashboard.tsx
git commit -m "feat(admin): seletor de edição, criar/encerrar edição e badge de status"
```

---

## Task 9: Sorteador — usar a edição e exibir o nome

**Files:**
- Modify: `app/admin/sorteio/Sorteador.tsx`

**Interfaces:**
- Consumes: `GET /api/raffle?edition=` (retorna `edition`), `GET /api/raffle/lookup?number=&edition=`, `POST /api/raffle?edition=`.

- [ ] **Step 1: Adicionar estado de edição**

Após a linha `const [loadingPool, setLoadingPool] = useState(true);` (linha 63), adicionar:

```tsx
  const [editionId, setEditionId] = useState<string>("");
  const [editionName, setEditionName] = useState<string>("");
```

- [ ] **Step 2: `refresh()` — ler o param `edition` e guardar id/nome**

Substituir a função `refresh` (linhas 79-92) por:

```tsx
  async function refresh() {
    setLoadingPool(true);
    try {
      const param = new URLSearchParams(window.location.search).get("edition");
      const qs = param ? `?edition=${param}` : "";
      const r = await fetch(`/api/raffle${qs}`);
      const d = await r.json();
      setPool(d.pool ?? []);
      setEditionId(d.edition?.id ?? param ?? "");
      setEditionName(d.edition?.name ?? "");
      if (d.winner) {
        setSavedWinner(d.winner);
        setPhase("saved");
      }
    } finally {
      setLoadingPool(false);
    }
  }
```

- [ ] **Step 3: `lookup` — passar a edição**

Substituir a linha (145):

```tsx
          const r = await fetch(`/api/raffle/lookup?number=${finalNumber}`);
```

por:

```tsx
          const r = await fetch(
            `/api/raffle/lookup?number=${finalNumber}${editionId ? `&edition=${editionId}` : ""}`,
          );
```

- [ ] **Step 4: `saveResult` — POST na edição**

Substituir a linha (177):

```tsx
      const r = await fetch("/api/raffle", {
```

por:

```tsx
      const r = await fetch(`/api/raffle${editionId ? `?edition=${editionId}` : ""}`, {
```

- [ ] **Step 5: Mostrar o nome da edição no cabeçalho**

Substituir o bloco (linhas 215-217):

```tsx
        <span className="text-xs uppercase tracking-[0.4em] text-gold/70">
          Sorteador AO VIVO
        </span>
```

por:

```tsx
        <span className="text-xs uppercase tracking-[0.4em] text-gold/70">
          {editionName ? `${editionName} · ` : ""}Sorteador AO VIVO
        </span>
```

- [ ] **Step 6: Verificar typecheck**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 7: Commit**

```bash
git add app/admin/sorteio/Sorteador.tsx
git commit -m "feat(sorteio): sortear dentro da edição ativa e exibir o nome"
```

---

## Task 10: Verificação end-to-end

**Files:** nenhum (validação manual + build final).

Rodar `npm run dev` com a migration já aplicada (Task 2) e percorrer:

- [ ] **Cenário 1 — Isolamento de telefone:** cadastrar um telefone na Edição 1 (`/cadastro`). No admin, "Nova edição" → "Edição 2". Cadastrar o **mesmo** telefone → aceito. Recadastrar o mesmo na Edição 2 → erro "Telefone já cadastrado".
- [ ] **Cenário 2 — Numeração reinicia:** a 1ª pessoa da Edição 2 recebe **#001** (ver em `/meu-cadastro` ou no admin).
- [ ] **Cenário 3 — Indicação não cruza edição:** pegar um `?ref=` de alguém da Edição 1, cadastrar na Edição 2 com esse ref → o referrer da Edição 1 **não** ganha bônus (código não resolve).
- [ ] **Cenário 4 — Bônus dentro da edição:** na Edição 2, cadastrar A, depois cadastrar B com `?ref=<codigo de A>` → A ganha +5 números (numerados na Edição 2).
- [ ] **Cenário 5 — Sorteio isolado:** abrir o sorteador (Edição 2 ativa) → pool só com números da Edição 2; sortear e salvar → vencedor aparece no badge da Edição 2; trocar o seletor para a Edição 1 → vencedor da Edição 1 preservado e independente.
- [ ] **Cenário 6 — Encerrar cadastros:** na Edição 2 ativa, "Encerrar cadastros" → novo cadastro em `/cadastro` retorna "Cadastros encerrados". "Reabrir cadastros" → volta a aceitar.
- [ ] **Cenário 7 — Export/stats por edição:** trocar o seletor muda os 4 cards e o CSV baixado (`?edition=`) reflete só a edição selecionada.

- [ ] **Step final: Build de produção**

Run: `npm run build`
Expected: build de produção passa sem erros.

- [ ] **Commit final (se houver ajustes):**

```bash
git add -A
git commit -m "test: verificação end-to-end das edições"
```

---

## Notas de rollback

- **App:** reverter os commits das Tasks 3-9 (`git revert`) restaura o comportamento anterior; o schema com `edition_id` continua compatível (as rotas antigas liam tudo global — mas como o backfill pôs tudo na Edição 1, uma reversão só do app volta a enxergar a Edição 1).
- **Banco:** a migration é forward-only (dropa `raffle_config`/sequence). Rollback de schema = restaurar do backup da Task 0. Por isso o backup é obrigatório antes da Task 2.
