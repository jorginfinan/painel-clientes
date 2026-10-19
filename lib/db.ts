import { createAdminClient } from "@/lib/supabase/server";
import type {
  Sistema,
  SistemaProprio,
  Pagamento,
  Melhoria,
  Tarefa,
  Renegociacao,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Camada de dados sobre o Supabase (Postgres). Mesma API da versão em arquivo,
// agora assíncrona. Usa service_role no servidor: a autorização (admin x
// cliente) é feita nas actions/páginas via getUsuarioAtual + filtros por id.
// ---------------------------------------------------------------------------

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "cliente";
  telefones?: string[];
  created_at: string;
};

export type LembreteEnviado = {
  id: string;
  pagamento_id: string;
  tipo: "aviso3" | "dia" | "atraso";
  telefone: string;
  data: string;
  created_at: string;
};

const sb = () => createAdminClient();
export const hojeStr = () => new Date().toISOString().slice(0, 10);

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ---------------------------- Usuários --------------------------------------

type ProfileRow = {
  id: string;
  nome: string | null;
  email: string | null;
  role: "admin" | "cliente";
  created_at: string;
};

async function anexarTelefones(rows: ProfileRow[]): Promise<Usuario[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const tels = must(
    await sb().from("telefones").select("usuario_id, telefone").in("usuario_id", ids)
  ) as { usuario_id: string; telefone: string }[];
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome ?? r.email ?? "",
    email: r.email ?? "",
    role: r.role,
    telefones: tels.filter((t) => t.usuario_id === r.id).map((t) => t.telefone),
    created_at: r.created_at,
  }));
}

export async function getUsuarioById(id: string): Promise<Usuario | undefined> {
  const { data } = await sb().from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) return undefined;
  return (await anexarTelefones([data as ProfileRow]))[0];
}

export async function listClientes(): Promise<Usuario[]> {
  const rows = must(
    await sb().from("profiles").select("*").eq("role", "cliente").order("nome")
  ) as ProfileRow[];
  return anexarTelefones(rows);
}

// Cria usuário no Supabase Auth (e o trigger cria o profile).
export async function criarUsuario(input: {
  nome: string;
  email: string;
  senha: string;
  role: "admin" | "cliente";
}): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const { data, error } = await sb().auth.admin.createUser({
    email: input.email,
    password: input.senha,
    email_confirm: true,
    user_metadata: { nome: input.nome, role: input.role },
  });
  if (error) return { ok: false, erro: error.message };
  // garante nome/role no profile mesmo se o trigger já rodou
  await sb()
    .from("profiles")
    .upsert({ id: data.user.id, email: input.email, nome: input.nome, role: input.role });
  return { ok: true, id: data.user.id };
}

export function normalizarTelefone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export async function adicionarTelefone(usuarioId: string, raw: string): Promise<void> {
  const tel = normalizarTelefone(raw);
  if (!tel) return;
  await sb()
    .from("telefones")
    .upsert({ usuario_id: usuarioId, telefone: tel }, { onConflict: "usuario_id,telefone" });
}

export async function removerTelefone(usuarioId: string, tel: string): Promise<void> {
  await sb().from("telefones").delete().eq("usuario_id", usuarioId).eq("telefone", tel);
}

// ---------------------------- Sistemas --------------------------------------

export async function listSistemas(): Promise<Sistema[]> {
  return must(await sb().from("sistemas").select("*").order("created_at")) as Sistema[];
}

export async function listSistemasByCliente(clienteId: string): Promise<Sistema[]> {
  return must(
    await sb().from("sistemas").select("*").eq("cliente_id", clienteId).order("created_at")
  ) as Sistema[];
}

export async function getSistema(id: string): Promise<Sistema | undefined> {
  const { data } = await sb().from("sistemas").select("*").eq("id", id).maybeSingle();
  return (data as Sistema) ?? undefined;
}

export async function criarSistema(input: Partial<Sistema> & { nome: string }): Promise<string> {
  const row = must(
    await sb()
      .from("sistemas")
      .insert({
        cliente_id: input.cliente_id ?? null,
        nome: input.nome,
        descricao: input.descricao ?? null,
        progresso: input.progresso ?? 0,
        valor_total: input.valor_total ?? 0,
        custo_mensal: input.custo_mensal ?? 0,
        status: input.status ?? "em_andamento",
      })
      .select("id")
      .single()
  ) as { id: string };
  return row.id;
}

export async function atualizarSistema(id: string, patch: Partial<Sistema>): Promise<void> {
  must(await sb().from("sistemas").update(patch).eq("id", id).select("id"));
}

export async function excluirSistema(id: string): Promise<void> {
  // pagamentos caem por cascade; melhorias/tarefas não têm FK -> limpa manual
  await sb().from("melhorias").delete().eq("sistema_id", id);
  await sb().from("tarefas").delete().eq("sistema_id", id);
  must(await sb().from("sistemas").delete().eq("id", id).select("id"));
}

// ---------------------- Sistemas próprios (Koryva) --------------------------

export async function listProprios(): Promise<SistemaProprio[]> {
  return must(await sb().from("proprios").select("*").order("created_at")) as SistemaProprio[];
}

export async function getProprio(id: string): Promise<SistemaProprio | undefined> {
  const { data } = await sb().from("proprios").select("*").eq("id", id).maybeSingle();
  return (data as SistemaProprio) ?? undefined;
}

export async function criarProprio(
  input: Partial<SistemaProprio> & { nome: string }
): Promise<string> {
  const row = must(
    await sb()
      .from("proprios")
      .insert({
        nome: input.nome,
        descricao: input.descricao ?? null,
        status: input.status ?? "desenvolvimento",
        progresso: input.progresso ?? 0,
        custo_mensal: input.custo_mensal ?? 0,
        receita_mensal: input.receita_mensal ?? 0,
        url: input.url ?? null,
        repositorio: input.repositorio ?? null,
        servidor: input.servidor ?? null,
        observacoes: input.observacoes ?? null,
      })
      .select("id")
      .single()
  ) as { id: string };
  return row.id;
}

export async function atualizarProprio(id: string, patch: Partial<SistemaProprio>): Promise<void> {
  must(await sb().from("proprios").update(patch).eq("id", id).select("id"));
}

export async function excluirProprio(id: string): Promise<void> {
  await sb().from("melhorias").delete().eq("sistema_id", id);
  await sb().from("tarefas").delete().eq("sistema_id", id);
  must(await sb().from("proprios").delete().eq("id", id).select("id"));
}

// ---------------------------- Pagamentos ------------------------------------

const numPag = (p: Pagamento): Pagamento => ({
  ...p,
  valor: Number(p.valor),
  valor_pago: Number(p.valor_pago ?? 0),
});

export async function listPagamentos(): Promise<Pagamento[]> {
  return (must(await sb().from("pagamentos").select("*")) as Pagamento[]).map(numPag);
}

export async function listPagamentosBySistema(sistemaId: string): Promise<Pagamento[]> {
  return (
    must(await sb().from("pagamentos").select("*").eq("sistema_id", sistemaId)) as Pagamento[]
  ).map(numPag);
}

export async function listPagamentosBySistemas(ids: string[]): Promise<Pagamento[]> {
  if (ids.length === 0) return [];
  return (
    must(await sb().from("pagamentos").select("*").in("sistema_id", ids)) as Pagamento[]
  ).map(numPag);
}

export async function criarPagamentos(
  linhas: Omit<Pagamento, "id" | "created_at" | "valor_pago">[]
): Promise<void> {
  if (linhas.length === 0) return;
  must(
    await sb()
      .from("pagamentos")
      .insert(linhas.map((l) => ({ ...l, valor_pago: 0 })))
      .select("id")
  );
}

const cent = (v: number) => Math.round(v * 100) / 100;

export async function registrarRecebimento(id: string, valor: number, data?: string): Promise<void> {
  const { data: p } = await sb().from("pagamentos").select("valor, valor_pago").eq("id", id).maybeSingle();
  if (!p) return;
  const atual = Number(p.valor_pago ?? 0);
  const total = Number(p.valor);
  const novo = cent(Math.min(total, Math.max(0, atual + valor)));
  must(
    await sb()
      .from("pagamentos")
      .update({
        valor_pago: novo,
        pago: novo >= total - 0.0001,
        data_pagamento: novo > 0 ? data || hojeStr() : null,
      })
      .eq("id", id)
      .select("id")
  );
}

export async function quitarPagamento(id: string, data?: string): Promise<void> {
  const { data: p } = await sb().from("pagamentos").select("valor").eq("id", id).maybeSingle();
  if (!p) return;
  must(
    await sb()
      .from("pagamentos")
      .update({ valor_pago: Number(p.valor), pago: true, data_pagamento: data || hojeStr() })
      .eq("id", id)
      .select("id")
  );
}

export async function estornarPagamento(id: string): Promise<void> {
  must(
    await sb()
      .from("pagamentos")
      .update({ valor_pago: 0, pago: false, data_pagamento: null })
      .eq("id", id)
      .select("id")
  );
}

export async function excluirPagamento(id: string): Promise<void> {
  must(await sb().from("pagamentos").delete().eq("id", id).select("id"));
}

export async function getPagamento(id: string): Promise<Pagamento | undefined> {
  const { data } = await sb().from("pagamentos").select("*").eq("id", id).maybeSingle();
  return data ? numPag(data as Pagamento) : undefined;
}

export async function atualizarPagamento(id: string, patch: Partial<Pagamento>): Promise<void> {
  must(await sb().from("pagamentos").update(patch).eq("id", id).select("id"));
}

// ---------------------------- Renegociação ----------------------------------

export async function listRenegociacoesBySistema(sistemaId: string): Promise<Renegociacao[]> {
  return (
    must(
      await sb()
        .from("renegociacoes")
        .select("*")
        .eq("sistema_id", sistemaId)
        .order("created_at", { ascending: false })
    ) as Renegociacao[]
  ).map((r) => ({
    ...r,
    valor_aberto: Number(r.valor_aberto),
    valor_novo: Number(r.valor_novo),
    entrada: Number(r.entrada),
  }));
}

// Encerra as parcelas escolhidas e cria as novas a partir do montante.
// `novas` já vêm calculadas (entrada + parcelas) pela action.
export async function criarRenegociacao(input: {
  sistema_id: string;
  pagamento_ids: string[];
  valor_aberto: number;
  valor_novo: number;
  entrada: number;
  num_parcelas: number;
  observacao: string | null;
  novas: Omit<Pagamento, "id" | "created_at" | "valor_pago" | "renegociacao_id" | "origem_renegociacao_id">[];
}): Promise<string> {
  const reneg = must(
    await sb()
      .from("renegociacoes")
      .insert({
        sistema_id: input.sistema_id,
        valor_aberto: input.valor_aberto,
        valor_novo: input.valor_novo,
        entrada: input.entrada,
        num_parcelas: input.num_parcelas,
        observacao: input.observacao,
      })
      .select("id")
      .single()
  ) as { id: string };

  try {
    // 1) encerra as antigas (ficam no histórico como "Renegociada")
    must(
      await sb()
        .from("pagamentos")
        .update({ renegociacao_id: reneg.id })
        .in("id", input.pagamento_ids)
        .eq("sistema_id", input.sistema_id)
        .select("id")
    );
    // 2) cria as novas
    must(
      await sb()
        .from("pagamentos")
        .insert(
          input.novas.map((l) => ({ ...l, valor_pago: 0, origem_renegociacao_id: reneg.id }))
        )
        .select("id")
    );
  } catch (e) {
    // desfaz o que deu pra desfazer, pra não deixar meio-renegociado
    await sb().from("pagamentos").delete().eq("origem_renegociacao_id", reneg.id);
    await sb().from("pagamentos").update({ renegociacao_id: null }).eq("renegociacao_id", reneg.id);
    await sb().from("renegociacoes").delete().eq("id", reneg.id);
    throw e;
  }
  return reneg.id;
}

// Desfaz: apaga as parcelas novas e reabre as antigas.
// Bloqueia se alguma parcela nova já recebeu pagamento.
export async function desfazerRenegociacao(
  id: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const novas = must(
    await sb().from("pagamentos").select("id, valor_pago").eq("origem_renegociacao_id", id)
  ) as { id: string; valor_pago: number }[];
  if (novas.some((p) => Number(p.valor_pago) > 0)) {
    return {
      ok: false,
      erro: "Já existe pagamento registrado nas parcelas da renegociação. Estorne antes de desfazer.",
    };
  }
  must(await sb().from("pagamentos").delete().eq("origem_renegociacao_id", id).select("id"));
  must(
    await sb().from("pagamentos").update({ renegociacao_id: null }).eq("renegociacao_id", id).select("id")
  );
  must(await sb().from("renegociacoes").delete().eq("id", id).select("id"));
  return { ok: true };
}

// ---------------------------- Melhorias -------------------------------------

export async function listMelhoriasBySistema(sistemaId: string): Promise<Melhoria[]> {
  return must(
    await sb().from("melhorias").select("*").eq("sistema_id", sistemaId).order("data", { ascending: false })
  ) as Melhoria[];
}

export async function listMelhoriasBySistemas(ids: string[]): Promise<Melhoria[]> {
  if (ids.length === 0) return [];
  return must(
    await sb().from("melhorias").select("*").in("sistema_id", ids).order("data", { ascending: false })
  ) as Melhoria[];
}

export async function criarMelhoria(input: Omit<Melhoria, "id" | "created_at">): Promise<void> {
  must(await sb().from("melhorias").insert(input).select("id"));
}

export async function excluirMelhoria(id: string): Promise<void> {
  must(await sb().from("melhorias").delete().eq("id", id).select("id"));
}

// ---------------------------- Tarefas ---------------------------------------

export async function listTarefas(): Promise<Tarefa[]> {
  return must(await sb().from("tarefas").select("*").order("created_at")) as Tarefa[];
}

export async function listTarefasBySistema(sistemaId: string): Promise<Tarefa[]> {
  return must(
    await sb().from("tarefas").select("*").eq("sistema_id", sistemaId).order("created_at")
  ) as Tarefa[];
}

export async function criarTarefa(
  input: Omit<Tarefa, "id" | "created_at" | "concluida">
): Promise<void> {
  must(await sb().from("tarefas").insert({ ...input, concluida: false }).select("id"));
}

export async function alternarTarefa(id: string): Promise<void> {
  const { data: t } = await sb().from("tarefas").select("concluida").eq("id", id).maybeSingle();
  if (!t) return;
  must(await sb().from("tarefas").update({ concluida: !t.concluida }).eq("id", id).select("id"));
}

export async function excluirTarefa(id: string): Promise<void> {
  must(await sb().from("tarefas").delete().eq("id", id).select("id"));
}

// ---------------------------- Lembretes enviados ---------------------------

export async function listLembretes(): Promise<LembreteEnviado[]> {
  return must(await sb().from("lembretes").select("*")) as LembreteEnviado[];
}

export async function registrarLembrete(input: {
  pagamento_id: string;
  tipo: LembreteEnviado["tipo"];
  telefone: string;
}): Promise<void> {
  must(await sb().from("lembretes").insert({ ...input, data: hojeStr() }).select("id"));
}

export async function desfazerLembrete(id: string): Promise<void> {
  must(await sb().from("lembretes").delete().eq("id", id).select("id"));
}
