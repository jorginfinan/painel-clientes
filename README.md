# Koryva — Painel de Clientes

Acompanhamento de vendas de software da Koryva: o admin cadastra sistemas, plano de
pagamento (parcelas com baixa parcial), custo mensal, % de conclusão, entregas e tarefas.
Cada cliente faz login e vê **só o que é dele** (situação financeira, pagamentos,
vencimentos, o que já foi feito). Inclui aba de **sistemas próprios** da Koryva e a
**fila de lembretes** de cobrança via WhatsApp.

Stack: **Next.js 16 (App Router) + Tailwind v4 + Supabase (Postgres + Auth)**.
Deploy: **Vercel** (via GitHub).

---

## 1. Supabase (banco + login)

1. Crie um projeto em https://supabase.com.
2. **SQL Editor → New query** → cole TODO o `supabase/schema.sql` → **Run**.
   (cria tabelas, trigger de perfil e regras de segurança RLS; pode rodar de novo)
3. **Project Settings → API Keys**: copie `Project URL`, `anon public` e `service_role`.

## 2. Rodar localmente

```bash
cp .env.local.example .env.local   # e preencha as 3 chaves
npm install
npm run dev                         # http://localhost:3000
```

## 3. Primeiro admin

Depois do primeiro login não existe admin ainda. Crie o usuário e promova:

1. Supabase → **Authentication → Users → Add user** (e-mail + senha, marque *Auto Confirm*).
2. **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin' where email = 'SEU@EMAIL';
   ```
3. Entre em `/login`. Você cai em `/admin`. Clientes você cria pela tela **Clientes**.

## 4. Migrar dados da versão local (se tiver `.data/db.json`)

```bash
node scripts/migrar.mjs
```
Cria os usuários no Auth (com **senha temporária** mostrada no final), e importa
sistemas, próprios, pagamentos, entregas, tarefas, telefones e lembretes preservando os IDs.
Pode rodar de novo (upsert).

## 5. Publicar (Vercel via GitHub)

1. Suba o repositório no GitHub.
2. https://vercel.com → **Add New Project** → importe o repo.
3. Em **Environment Variables**, adicione as 3 chaves do `.env.local`.
4. **Deploy**. Cada `git push` publica de novo automaticamente.

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY` só é usada no servidor (`lib/supabase/server.ts`). Nunca vai
  pro browser. `.env.local` e `.data/` são ignorados pelo Git.
- RLS garante no banco que um cliente não lê dados de outro.
