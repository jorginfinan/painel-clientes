// =============================================================================
// Migra os dados de .data/db.json (versão local) para o Supabase.
//
// Uso:
//   node scripts/migrar.mjs
//
// Lê as chaves de .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
// Preserva os IDs originais (UUIDs), então os vínculos ficam iguais.
// Idempotente: pode rodar de novo — usa upsert por id.
//
// Usuários: são criados no Supabase Auth com uma SENHA TEMPORÁRIA (mostrada no
// final). As senhas antigas NÃO migram (hash incompatível). Cada um troca depois.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// --- env -------------------------------------------------------------------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY || URL.includes("placeholder") || KEY === "placeholder") {
  console.error("❌ Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// --- dados locais ----------------------------------------------------------
const dbPath = path.join(process.cwd(), ".data", "db.json");
if (!fs.existsSync(dbPath)) {
  console.error("❌ .data/db.json não encontrado.");
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
db.proprios ??= [];
db.lembretes ??= [];

const senhaTemp = () => crypto.randomBytes(6).toString("base64url"); // ~8 chars
const must = (r, oque) => {
  if (r.error) throw new Error(`${oque}: ${r.error.message}`);
  return r.data;
};

console.log("🚀 Migrando para", URL);
console.log(`   usuários=${db.usuarios.length} sistemas=${db.sistemas.length} proprios=${db.proprios.length} pagamentos=${db.pagamentos.length} melhorias=${db.melhorias.length} tarefas=${db.tarefas.length} lembretes=${db.lembretes.length}\n`);

// --- 1) usuários (Auth + profiles) ------------------------------------------
// Mapa id_antigo -> id_novo (o Auth gera id novo; a gente tenta manter o mesmo).
const idMap = new Map();
const credenciais = [];

const { data: existentes } = await sb.auth.admin.listUsers({ perPage: 1000 });
const porEmail = new Map((existentes?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

for (const u of db.usuarios) {
  const email = u.email.toLowerCase();
  let authUser = porEmail.get(email);
  let senha = null;

  if (!authUser) {
    senha = senhaTemp();
    // tenta manter o MESMO id do banco local (Supabase permite informar id)
    const { data, error } = await sb.auth.admin.createUser({
      id: u.id,
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: u.nome, role: u.role },
    });
    if (error) throw new Error(`criar usuário ${email}: ${error.message}`);
    authUser = data.user;
    console.log(`👤 criado   ${email} (${u.role})`);
  } else {
    console.log(`👤 já existe ${email} (${u.role}) — mantido`);
  }
  idMap.set(u.id, authUser.id);

  // garante profile com nome/role certos
  must(
    await sb.from("profiles").upsert({
      id: authUser.id,
      email,
      nome: u.nome,
      role: u.role,
      created_at: u.created_at,
    }),
    "profile"
  );

  // telefones
  for (const t of u.telefones ?? []) {
    must(
      await sb.from("telefones").upsert(
        { usuario_id: authUser.id, telefone: t },
        { onConflict: "usuario_id,telefone" }
      ),
      "telefone"
    );
  }

  credenciais.push({ email, role: u.role, senha });
}

// --- 2) sistemas -----------------------------------------------------------
for (const s of db.sistemas) {
  must(
    await sb.from("sistemas").upsert({
      id: s.id,
      cliente_id: s.cliente_id ? idMap.get(s.cliente_id) ?? null : null,
      nome: s.nome,
      descricao: s.descricao ?? null,
      progresso: s.progresso ?? 0,
      valor_total: s.valor_total ?? 0,
      custo_mensal: s.custo_mensal ?? 0,
      status: s.status ?? "em_andamento",
      created_at: s.created_at,
    }),
    `sistema ${s.nome}`
  );
}
console.log(`🧩 sistemas: ${db.sistemas.length}`);

// --- 3) próprios -----------------------------------------------------------
for (const p of db.proprios) {
  must(
    await sb.from("proprios").upsert({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? null,
      status: p.status ?? "desenvolvimento",
      progresso: p.progresso ?? 0,
      custo_mensal: p.custo_mensal ?? 0,
      receita_mensal: p.receita_mensal ?? 0,
      url: p.url ?? null,
      repositorio: p.repositorio ?? null,
      servidor: p.servidor ?? null,
      observacoes: p.observacoes ?? null,
      created_at: p.created_at,
    }),
    `proprio ${p.nome}`
  );
}
console.log(`🏢 próprios: ${db.proprios.length}`);

// --- 4) pagamentos ---------------------------------------------------------
if (db.pagamentos.length) {
  must(
    await sb.from("pagamentos").upsert(
      db.pagamentos.map((p) => ({
        id: p.id,
        sistema_id: p.sistema_id,
        descricao: p.descricao,
        valor: p.valor ?? 0,
        valor_pago: p.valor_pago ?? (p.pago ? p.valor : 0),
        vencimento: p.vencimento ?? null,
        pago: !!p.pago,
        data_pagamento: p.data_pagamento ?? null,
        tipo: p.tipo ?? "parcela",
        created_at: p.created_at,
      }))
    ),
    "pagamentos"
  );
}
console.log(`💰 pagamentos: ${db.pagamentos.length}`);

// --- 5) melhorias ----------------------------------------------------------
if (db.melhorias.length) {
  must(
    await sb.from("melhorias").upsert(
      db.melhorias.map((m) => ({
        id: m.id,
        sistema_id: m.sistema_id,
        titulo: m.titulo,
        descricao: m.descricao ?? null,
        data: m.data,
        created_at: m.created_at,
      }))
    ),
    "melhorias"
  );
}
console.log(`✨ melhorias: ${db.melhorias.length}`);

// --- 6) tarefas ------------------------------------------------------------
if (db.tarefas.length) {
  must(
    await sb.from("tarefas").upsert(
      db.tarefas.map((t) => ({
        id: t.id,
        sistema_id: t.sistema_id ?? null,
        titulo: t.titulo,
        descricao: t.descricao ?? null,
        prioridade: t.prioridade ?? "media",
        concluida: !!t.concluida,
        created_at: t.created_at,
      }))
    ),
    "tarefas"
  );
}
console.log(`✅ tarefas: ${db.tarefas.length}`);

// --- 7) lembretes ----------------------------------------------------------
if (db.lembretes.length) {
  must(
    await sb.from("lembretes").upsert(
      db.lembretes.map((l) => ({
        id: l.id,
        pagamento_id: l.pagamento_id,
        tipo: l.tipo,
        telefone: l.telefone,
        data: l.data,
        created_at: l.created_at,
      }))
    ),
    "lembretes"
  );
}
console.log(`🔔 lembretes: ${db.lembretes.length}`);

// --- resumo ----------------------------------------------------------------
console.log("\n🎉 Migração concluída!\n");
console.log("🔑 CREDENCIAIS (senhas temporárias — troque depois):");
for (const c of credenciais) {
  console.log(`   ${c.role.padEnd(8)} ${c.email.padEnd(32)} ${c.senha ? "senha: " + c.senha : "(usuário já existia — senha mantida)"}`);
}
console.log("\n⚠️  Guarde essas senhas. Elas não serão mostradas de novo.");
