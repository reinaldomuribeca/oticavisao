# Sorteio Ótica Visão

Sistema web de cadastro com sistema de indicação e sorteador AO VIVO.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn-style UI · Supabase · Framer Motion · canvas-confetti

---

## 1. Configuração local

### 1.1 Instalar dependências

```bash
npm install
```

### 1.2 Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ADMIN_PASSWORD=<senha-forte-do-admin>
NEXT_PUBLIC_BASE_URL=https://seudominio.com.br
NEXT_PUBLIC_RAFFLE_DATE=2026-05-07T20:00:00-03:00
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_PASSWORD` são **secretos** — nunca exponha no cliente nem comite no git.

### 1.3 Criar o schema no Supabase

No painel do Supabase → **SQL Editor** → cole e execute o conteúdo de:

```
supabase/migrations/0001_init.sql
```

Isso cria as tabelas (`participants`, `raffle_numbers`, `raffle_config`), a sequence de números, a view `participants_with_stats` e as RPCs (`register_participant`, `save_winner`).

> Alternativamente, com a Supabase CLI instalada: `supabase db push`.

### 1.4 Rodar em dev

```bash
npm run dev
# http://localhost:3000
```

---

## 2. Páginas

| Rota | Descrição |
|---|---|
| `/` | Home com countdown, regras e CTAs |
| `/cadastro` | Formulário de cadastro (suporta `?ref=CODIGO`) |
| `/meu-cadastro` | Área do participante (busca por telefone) |
| `/admin` | Login + dashboard com leads e métricas |
| `/admin/sorteio` | Sorteador AO VIVO com animação |

---

## 3. Regras de negócio

- Cadastro gera **1 número** automaticamente (`origin = 'cadastro'`).
- Cadastro via link de indicação dá **+5 números** ao indicador (`origin = 'indicacao'`).
- A numeração é **sequencial global** (todos os números vêm da mesma sequence).
- Telefone é único; tentativa de re-cadastro redireciona para `/meu-cadastro`.
- O sorteio escolhe um número aleatório do pool real (sempre mapeia a um participante).
- Painel admin protegido por senha simples (cookie HMAC, 12h).

---

## 4. Build de produção

```bash
npm run build
npm run start
```

---

## 5. Deploy no Coolify (VPS)

1. **Crie um app Next.js no Coolify** apontando para este repositório.
2. **Build command:** `npm run build`
3. **Start command:** `npm run start`
4. **Porta:** `3000`
5. **Variáveis de ambiente:** copie todas do `.env.example` preenchendo os valores reais.
6. **Domínio + HTTPS:** configure pelo painel do Coolify (Let's Encrypt automático).

> Opcional: Coolify aceita Dockerfile próprio. Para uma imagem mínima, adicione um `Dockerfile` baseado em `node:20-alpine` com `npm ci && npm run build` e `CMD ["npm","start"]`.

---

## 6. Operação no dia do sorteio

1. Acesse `/admin` e faça login.
2. Confira métricas no dashboard (cadastros, números, indicações).
3. Antes da live, exporte o CSV (`EXPORTAR CSV`) como backup.
4. Quando estiver no momento do sorteio, abra `/admin/sorteio`.
5. Clique em **INICIAR SORTEIO** — animação de ~8s revela o vencedor.
6. Clique em **SALVAR RESULTADO** para gravar o número vencedor no banco.
7. O resultado fica visível tanto na página `/admin/sorteio` quanto no dashboard.

---

## 7. Estrutura do projeto

```
app/
  page.tsx                      # Home
  cadastro/                     # /cadastro + ReferralBanner + CadastroForm
  meu-cadastro/                 # /meu-cadastro + lookup por telefone
  admin/                        # /admin (login ou dashboard)
  admin/sorteio/                # /admin/sorteio (sorteador animado)
  api/
    participants/               # POST cadastrar | GET me | GET referrer
    admin/                      # login/logout/stats/leads/export
    raffle/                     # GET pool | POST salvar vencedor | GET lookup
components/
  ui/                           # button, input, card, badge, label, table
  CountdownTimer.tsx
  ShareButton.tsx               # CopyLinkButton + WhatsAppShareButton
lib/
  supabase.ts                   # browser + service clients
  admin-auth.ts                 # cookie HMAC
  utils.ts                      # cn, formatPhoneBR, toCSV
middleware.ts                   # protege /admin/sorteio + /api/admin + /api/raffle
supabase/migrations/0001_init.sql
```
