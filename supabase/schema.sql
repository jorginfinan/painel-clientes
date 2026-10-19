-- =====================================================================
-- KORYVA — Painel de Clientes — schema completo + RLS (Supabase)
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo com segurança (idempotente).
-- =====================================================================

-- ---------- Perfis (1 por usuário do Auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text,
  email       text,
  role        text not null default 'cliente' check (role in ('admin', 'cliente')),
  created_at  timestamptz not null default now()
);

-- ---------- Sistemas vendidos a clientes ----------
create table if not exists public.sistemas (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references public.profiles (id) on delete set null,
  nome         text not null,
  descricao    text,
  progresso    int  not null default 0 check (progresso between 0 and 100),
  valor_total  numeric(12,2) not null default 0,
  custo_mensal numeric(12,2) not null default 0,
  status       text not null default 'em_andamento'
               check (status in ('em_andamento', 'concluido', 'pausado')),
  created_at   timestamptz not null default now()
);

-- ---------- Sistemas PRÓPRIOS da Koryva ----------
create table if not exists public.proprios (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descricao      text,
  status         text not null default 'desenvolvimento'
                 check (status in ('desenvolvimento', 'no_ar', 'pausado')),
  progresso      int not null default 0 check (progresso between 0 and 100),
  custo_mensal   numeric(12,2) not null default 0,
  receita_mensal numeric(12,2) not null default 0,
  url            text,
  repositorio    text,
  servidor       text,
  observacoes    text,
  created_at     timestamptz not null default now()
);

-- ---------- Pagamentos (parcelas etc.) — com baixa parcial ----------
create table if not exists public.pagamentos (
  id              uuid primary key default gen_random_uuid(),
  sistema_id      uuid not null references public.sistemas (id) on delete cascade,
  descricao       text not null,
  valor           numeric(12,2) not null default 0,
  valor_pago      numeric(12,2) not null default 0,
  vencimento      date,
  pago            boolean not null default false,
  data_pagamento  date,
  tipo            text not null default 'parcela'
                  check (tipo in ('parcela', 'mensalidade', 'avulso', 'entrada', 'conclusao')),
  created_at      timestamptz not null default now()
);

-- ---------- Melhorias / "o que já foi feito" ----------
-- sistema_id aponta para sistemas.id OU proprios.id (por isso sem FK).
create table if not exists public.melhorias (
  id          uuid primary key default gen_random_uuid(),
  sistema_id  uuid not null,
  titulo      text not null,
  descricao   text,
  data        date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ---------- Tarefas internas (só admin) ----------
-- sistema_id aponta para sistemas.id OU proprios.id OU null (geral).
create table if not exists public.tarefas (
  id          uuid primary key default gen_random_uuid(),
  sistema_id  uuid,
  titulo      text not null,
  descricao   text,
  prioridade  text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  concluida   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- Telefones (WhatsApp) do cliente ----------
create table if not exists public.telefones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.profiles (id) on delete cascade,
  telefone    text not null,   -- só dígitos com DDI: 5583999998888
  created_at  timestamptz not null default now(),
  unique (usuario_id, telefone)
);

-- ---------- Lembretes enviados (fila do dia) ----------
create table if not exists public.lembretes (
  id            uuid primary key default gen_random_uuid(),
  pagamento_id  uuid not null references public.pagamentos (id) on delete cascade,
  tipo          text not null check (tipo in ('aviso3', 'dia', 'atraso')),
  telefone      text not null,
  data          date not null default current_date,
  created_at    timestamptz not null default now()
);

-- ---------- Colunas adicionadas depois (bancos criados com schema antigo) ----------
alter table public.pagamentos add column if not exists valor_pago numeric(12,2) not null default 0;
-- garante o check de tipo com os valores novos (entrada/conclusao)
alter table public.pagamentos drop constraint if exists pagamentos_tipo_check;
alter table public.pagamentos add constraint pagamentos_tipo_check
  check (tipo in ('parcela', 'mensalidade', 'avulso', 'entrada', 'conclusao'));

-- ---------- Renegociação do saldo em aberto ----------
create table if not exists public.renegociacoes (
  id            uuid primary key default gen_random_uuid(),
  sistema_id    uuid not null references public.sistemas (id) on delete cascade,
  valor_aberto  numeric(12,2) not null,           -- saldo das parcelas encerradas
  valor_novo    numeric(12,2) not null,           -- montante renegociado (± juros/desconto)
  entrada       numeric(12,2) not null default 0,
  num_parcelas  int not null default 0,
  observacao    text,
  created_at    timestamptz not null default now()
);
-- parcela antiga encerrada por uma renegociação
alter table public.pagamentos add column if not exists renegociacao_id uuid
  references public.renegociacoes (id) on delete set null;
-- parcela nova criada por uma renegociação
alter table public.pagamentos add column if not exists origem_renegociacao_id uuid
  references public.renegociacoes (id) on delete cascade;
create index if not exists idx_pagamentos_reneg  on public.pagamentos (renegociacao_id);
create index if not exists idx_pagamentos_origem on public.pagamentos (origem_renegociacao_id);
create index if not exists idx_renegociacoes_sis on public.renegociacoes (sistema_id);

create index if not exists idx_sistemas_cliente    on public.sistemas (cliente_id);
create index if not exists idx_pagamentos_sistema  on public.pagamentos (sistema_id);
create index if not exists idx_melhorias_sistema   on public.melhorias (sistema_id);
create index if not exists idx_tarefas_sistema     on public.tarefas (sistema_id);
create index if not exists idx_telefones_usuario   on public.telefones (usuario_id);
create index if not exists idx_lembretes_pagamento on public.lembretes (pagamento_id);

-- ---------- Cria profile automaticamente ao criar usuário no Auth ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    coalesce(new.raw_user_meta_data ->> 'role', 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper: usuário atual é admin? ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- RLS ----------
alter table public.profiles   enable row level security;
alter table public.sistemas   enable row level security;
alter table public.proprios   enable row level security;
alter table public.pagamentos enable row level security;
alter table public.melhorias  enable row level security;
alter table public.tarefas    enable row level security;
alter table public.telefones  enable row level security;
alter table public.lembretes  enable row level security;

-- profiles: vê o próprio; admin vê/edita todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- sistemas: cliente vê os seus; admin tudo
drop policy if exists sistemas_select on public.sistemas;
create policy sistemas_select on public.sistemas
  for select using (cliente_id = auth.uid() or public.is_admin());
drop policy if exists sistemas_admin_write on public.sistemas;
create policy sistemas_admin_write on public.sistemas
  for all using (public.is_admin()) with check (public.is_admin());

-- proprios: SÓ admin
drop policy if exists proprios_admin_all on public.proprios;
create policy proprios_admin_all on public.proprios
  for all using (public.is_admin()) with check (public.is_admin());

-- pagamentos: cliente vê os dos seus sistemas; admin tudo
drop policy if exists pagamentos_select on public.pagamentos;
create policy pagamentos_select on public.pagamentos
  for select using (
    public.is_admin()
    or sistema_id in (select id from public.sistemas where cliente_id = auth.uid())
  );
drop policy if exists pagamentos_admin_write on public.pagamentos;
create policy pagamentos_admin_write on public.pagamentos
  for all using (public.is_admin()) with check (public.is_admin());

-- melhorias: cliente vê as dos seus sistemas; admin tudo
drop policy if exists melhorias_select on public.melhorias;
create policy melhorias_select on public.melhorias
  for select using (
    public.is_admin()
    or sistema_id in (select id from public.sistemas where cliente_id = auth.uid())
  );
drop policy if exists melhorias_admin_write on public.melhorias;
create policy melhorias_admin_write on public.melhorias
  for all using (public.is_admin()) with check (public.is_admin());

-- tarefas: SÓ admin
drop policy if exists tarefas_admin_all on public.tarefas;
create policy tarefas_admin_all on public.tarefas
  for all using (public.is_admin()) with check (public.is_admin());

-- telefones: SÓ admin (cliente não precisa ver)
drop policy if exists telefones_admin_all on public.telefones;
create policy telefones_admin_all on public.telefones
  for all using (public.is_admin()) with check (public.is_admin());

-- lembretes: SÓ admin
drop policy if exists lembretes_admin_all on public.lembretes;
create policy lembretes_admin_all on public.lembretes
  for all using (public.is_admin()) with check (public.is_admin());

-- renegociacoes: cliente vê as dos seus sistemas; admin tudo
alter table public.renegociacoes enable row level security;
drop policy if exists renegociacoes_select on public.renegociacoes;
create policy renegociacoes_select on public.renegociacoes
  for select using (
    public.is_admin()
    or sistema_id in (select id from public.sistemas where cliente_id = auth.uid())
  );
drop policy if exists renegociacoes_admin_write on public.renegociacoes;
create policy renegociacoes_admin_write on public.renegociacoes
  for all using (public.is_admin()) with check (public.is_admin());
