# Design — Edições de Sorteio (Ótica Visão)

**Data:** 2026-07-06
**Status:** Aprovado (design) — aguardando revisão do spec
**Autor:** Reinaldo + Claude

## Contexto

O app (`oticavisao-sorteio`, Next.js 14 App Router + Supabase/Postgres) tem hoje três
funcionalidades que compartilham **um único conjunto global de dados**:

- **Cadastro público** (`app/cadastro`) → grava em `participants` + `raffle_numbers` via RPC `register_participant`.
- **Admin** (`app/admin`) → lê `participants_with_stats`, gera stats/CSV, exclui leads.
- **Sorteador** (`app/admin/sorteio`) → lê **todos** os `raffle_numbers` e salva o vencedor em `raffle_config` (singleton).

Não existe nenhuma noção de edição/campanha/evento. Ao rodar uma nova live, os dados
da anterior se misturam com os novos e o sorteio consideraria todo mundo.

## Objetivo

Introduzir **edições**: unidades de isolamento que permitem criar uma nova edição,
encerrar a antiga e iniciar a nova, de forma que:

1. Os dados de cada edição **nunca se misturam**.
2. O sorteio considera **apenas** quem se cadastrou naquela edição.
3. O histórico das edições encerradas continua consultável no admin.

## Decisões de produto (confirmadas)

| Tema | Decisão |
|---|---|
| **Numeração dos números** | Reinicia em **#1** a cada edição (`UNIQUE(edition_id, number)`, contador por edição). |
| **Mesmo telefone em nova edição** | **Pode recadastrar** — telefone único **por edição** (`UNIQUE(edition_id, phone)`). |
| **Indicações (referral + bônus +5)** | **Reiniciam por edição** — código só resolve dentro da edição ativa (`UNIQUE(edition_id, referral_code)`). |
| **Edições encerradas no admin** | Ficam **visíveis** (histórico read-only via seletor de edição). Default sensato, não questionado. |
| **Edição ativa** | **No máximo uma** ativa por vez; o cadastro público sempre alimenta a ativa. |

## Arquitetura escolhida (Abordagem A)

`edition_id` em `participants` e `raffle_numbers`; nova tabela `editions` substitui o
singleton `raffle_config` como fonte do estado de cada sorteio. Multi-tenancy leve por
coluna, uma migration única de backfill, front público praticamente inalterado (o
backend resolve a edição ativa sozinho).

Abordagens rejeitadas:
- **B (manter `raffle_config` + `editions` só como rótulo):** estado do sorteio em dois lugares → bugs.
- **C (um banco/projeto Supabase por edição):** recriar schema e trocar env vars a cada live, sem histórico unificado. Overkill operacional.

## Modelo de dados

### Nova tabela `editions`

```sql
create table public.editions (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  is_active             boolean not null default false,
  cadastros_encerrados  boolean not null default false,
  last_number           integer not null default 0,   -- contador de numeração POR edição
  winner_number         integer,                       -- número vencedor desta edição
  drawn_at              timestamptz,
  created_at            timestamptz not null default now(),
  closed_at             timestamptz
);

-- No máximo UMA edição ativa por vez
create unique index editions_single_active_idx
  on public.editions ((is_active)) where is_active;
```

`cadastros_encerrados` herda o papel do antigo `raffle_config.is_locked`, mas agora por edição.

### Alterações em `participants` e `raffle_numbers`

Ambas ganham `edition_id uuid not null references editions(id)`. As chaves de unicidade
**globais** viram **compostas por edição**:

| Tabela | Antes (global) | Depois (por edição) |
|---|---|---|
| `participants` | `phone UNIQUE` | `UNIQUE(edition_id, phone)` |
| `participants` | `referral_code UNIQUE` | `UNIQUE(edition_id, referral_code)` |
| `raffle_numbers` | `number UNIQUE` | `UNIQUE(edition_id, number)` |

Índices por `edition_id` em ambas as tabelas para os filtros do admin/sorteio.

A sequence global `raffle_number_seq` e a tabela singleton `raffle_config` são **aposentadas**
(dados migrados para `editions`).

## Ciclo de vida da edição

```
[Nova edição] --(create_edition)--> ATIVA (cadastros abertos)
   |                                    |
   |                          (set_registration_lock true)
   |                                    v
   |                            ATIVA (cadastros encerrados)
   |                                    |
   |                               (sorteio) --> winner_number salvo
   v
[Criar próxima edição] --> a atual vira INATIVA + cadastros encerrados (closed_at)
                           a nova vira ATIVA, pool vazia, numeração do #1
```

Ações no admin:
- **Nova edição** (`create_edition`): encerra a ativa atual (inativa + cadastros encerrados + `closed_at`) e cria a nova como ativa. Um clique = "encerrar a antiga e iniciar a nova".
- **Encerrar / reabrir cadastros** (`set_registration_lock`): congela/reabre entradas da edição ativa sem criar a próxima (usado antes/durante o sorteio).
- **Sortear**: pool = números da edição ativa; vencedor salvo nela.
- **Consultar edições passadas**: seletor no dashboard; abre qualquer edição em modo leitura.

## Backend (RPCs PL/pgSQL)

Todas `security definer`, `set search_path = public, pg_temp`.

### `register_participant(p_name, p_phone, p_ref_code)` — reescrita

Assinatura **inalterada** (o front continua enviando só nome/telefone/ref). Passa a:

1. Resolver a edição ativa: `select id, cadastros_encerrados from editions where is_active`.
   Se não houver ativa **ou** `cadastros_encerrados` → retorna `{error:'locked'}`.
2. Duplicidade **por edição**: `where edition_id = v_edition and phone = p_phone` → `{error:'duplicate'}`.
3. Referrer **por edição**: `where edition_id = v_edition and referral_code = p_ref_code` (silencioso se inválido — um código antigo de outra edição simplesmente não resolve).
4. Gerar `referral_code` único **dentro da edição**.
5. Reservar bloco de numeração atômico (sem corrida, o `UPDATE ... RETURNING` trava a linha da edição):
   ```sql
   v_count := 1 + (case when v_referrer is not null then 5 else 0 end);
   update public.editions set last_number = last_number + v_count
     where id = v_edition returning last_number into v_top;
   -- bloco reservado: [v_top - v_count + 1 .. v_top]
   -- 1º número -> novo participante; 5 seguintes -> referrer
   ```
6. Inserir participante e `raffle_numbers` **com `edition_id`**; bônus do referrer com `origin='indicacao'` e `source_participant_id`.

### Novas RPCs (service_role apenas)

- `create_edition(p_name text) returns json`:
  `update editions set is_active=false, cadastros_encerrados=true, closed_at=now() where is_active;`
  depois `insert ... (name, is_active=true, cadastros_encerrados=false, last_number=0) returning`.
- `set_registration_lock(p_edition_id uuid, p_locked boolean) returns json`:
  `update editions set cadastros_encerrados = p_locked where id = p_edition_id`.

### `save_winner(p_edition_id uuid, p_winner integer)` — assinatura atualizada

Grava `winner_number`/`drawn_at` na **edição informada**. Continua `service_role`.

### `delete_participant(p_id uuid)` — inalterada

Opera por participante; a reversão de bônus é por `source_participant_id`, cujos números
já pertencem à mesma edição. Sem mudança de escopo.

### View `participants_with_stats`

Adiciona `edition_id`. `referral_count`/`referrer_name` já ficam naturalmente escopados
(o `referred_by` sempre aponta para participante da mesma edição, pois a resolução do
referrer é por edição). Mantém `security_invoker = true`.

## APIs (Route Handlers)

| Rota | Mudança |
|---|---|
| `POST /api/participants` | Nenhuma na assinatura (RPC resolve a edição ativa). |
| `GET /api/participants/me?phone=` | Filtra pela **edição ativa** (`edition_id = ativa and phone = ...`). |
| `GET /api/participants/referrer?code=` | Resolve o código **na edição ativa**. |
| `GET /api/admin/leads` | Aceita `?edition=<id>` (default = ativa); filtra a view por `edition_id`. |
| `GET /api/admin/stats` | Idem — stats escopadas por edição. |
| `GET /api/admin/export` | Idem — CSV da edição selecionada. |
| `GET/POST /api/raffle` | Aceita `?edition=<id>` (default = ativa). Pool e `save_winner` escopados por edição. |
| `GET /api/raffle/lookup?number=` | Aceita `edition` (default = ativa) — `number` agora só é único por edição. |
| **`GET /api/admin/editions`** (nova) | Lista edições (id, name, is_active, cadastros_encerrados, contagens, winner). |
| **`POST /api/admin/editions`** (nova) | Cria nova edição (chama `create_edition`). |
| **`PATCH /api/admin/editions/[id]`** (nova) | Encerra/reabre cadastros (chama `set_registration_lock`). |

Todas as rotas admin continuam protegidas por `isAdminAuthed()` + `middleware.ts`.

## UI

### Dashboard (`app/admin/Dashboard.tsx`)
- **Seletor de edição** no topo (lista via `/api/admin/editions`; default = ativa). Troca a edição refaz stats/leads/export.
- Botão **"Nova edição"** (pede o nome; chama `POST /api/admin/editions`; após criar, seleciona a nova).
- Botão **"Encerrar cadastros" / "Reabrir cadastros"** para a edição ativa (`PATCH`).
- **Badge** de status: `Ativa · cadastros abertos/encerrados` ou `Encerrada`, + vencedor se já sorteada.

### Sorteador (`app/admin/sorteio/Sorteador.tsx`)
- Opera na **edição ativa** (ou na passada via `?edition=`); cabeçalho mostra o nome da edição.
- Pool, `lookup` e `save_winner` já escopados. Nenhuma mudança na animação.

### Front público
- `CadastroForm`, `ReferralBanner`, `?ref=` — **sem mudança**. O servidor resolve a edição ativa.

## Migração — `supabase/migrations/0004_editions.sql`

Aplicada manualmente no SQL Editor (padrão do projeto). Idempotente onde possível.

1. `create table if not exists public.editions ...` + índice de ativa única.
2. Criar **"Edição 1"** (ativa) se ainda não houver nenhuma edição.
3. `alter table participants add column if not exists edition_id ...`; idem `raffle_numbers`.
4. **Backfill:** `update ... set edition_id = <Edição 1>` onde `edition_id is null`.
5. Migrar o singleton `raffle_config` → `editions` da Edição 1 (`winner_number`, `drawn_at`,
   `is_locked` → `cadastros_encerrados`).
6. `last_number` da Edição 1 = `coalesce(max(number),0)` dos seus `raffle_numbers`.
7. `alter column edition_id set not null`; adicionar FKs e índices por `edition_id`.
8. Trocar constraints de unicidade: drop das globais (`participants_phone_key`,
   `participants_referral_code_key`, `raffle_numbers_number_key`) → add compostas por edição.
   Guardado por checagem de existência.
9. Reescrever as RPCs (`register_participant`, `save_winner`) e criar `create_edition`,
   `set_registration_lock`. Atualizar a view.
10. `drop sequence if exists raffle_number_seq`; `drop table if exists raffle_config`
    (após migrar os dados). Reaplicar grants (service_role) nas RPCs sensíveis.

Nenhum dado é perdido: tudo que existe hoje vira a Edição 1, ativa.

## Casos de erro

- **Sem edição ativa** ou **cadastros encerrados** no cadastro público → `{error:'locked'}` (já tratado no front: mensagem "Cadastros encerrados").
- **Sorteio com pool vazia** → botão "INICIAR SORTEIO" desabilitado (comportamento atual mantido).
- **Criar edição sem nome** → validação 400 na rota.
- **Salvar vencedor de número fora do pool da edição** → `number_not_in_pool` (validação já existente, agora escopada por edição).

## Plano de testes

1. **Isolamento de telefone:** cadastrar o mesmo telefone na Edição 1 e na Edição 2 → ambos aceitos; duplicar na mesma edição → 409.
2. **Numeração reinicia:** primeira pessoa da Edição 2 recebe **#001**.
3. **Indicação não cruza edição:** usar um `ref` da Edição 1 ao cadastrar na Edição 2 → sem bônus (código não resolve).
4. **Bônus dentro da edição:** indicação válida na mesma edição → referrer ganha +5, numerados na edição.
5. **Sorteio isolado:** pool da Edição 2 = só números da Edição 2; vencedor salvo na Edição 2, não afeta a 1.
6. **Admin filtrando:** trocar de edição no seletor muda stats/leads/CSV; edição encerrada aparece read-only com seu vencedor.
7. **Ciclo:** "Nova edição" encerra a anterior (inativa + cadastros encerrados) e ativa a nova vazia.
8. **Backfill:** após a migration, todos os participantes/números atuais estão na Edição 1 e o vencedor salvo (se houver) é preservado.

## Arquivos afetados

- **SQL:** `supabase/migrations/0004_editions.sql` (novo).
- **Libs/tipos:** `lib/supabase.ts` (tipos das novas colunas/tabela).
- **APIs:** `app/api/participants/{route,me,referrer}`, `app/api/raffle/{route,lookup}`,
  `app/api/admin/{leads,stats,export}`, + `app/api/admin/editions/{route,[id]}` (novas).
- **UI:** `app/admin/Dashboard.tsx`, `app/admin/sorteio/{page,Sorteador}.tsx`.

## Fora de escopo (YAGNI)

- Reativar uma edição encerrada (não há caso de uso — cria-se uma nova).
- Sortear várias edições simultaneamente.
- Verificação real de Instagram (continua honra + checagem manual, como hoje).
- Múltiplos vencedores por edição / sorteio de prêmios secundários.
