import {
  hoje,
  recebidoDe,
  saldoDe,
  resumoPagamentos,
  aplicarSuspensao,
} from "@/lib/format";
import type { Sistema, Pagamento } from "@/lib/types";
import * as db from "@/lib/db";

export type PagComSistema = Pagamento & { sistema_nome: string; suspenso: boolean };

// Carrega tudo que o cliente precisa e pré-calcula os resumos.
export async function carregarResumoCliente(clienteId: string) {
  const sistemas = await db.listSistemasByCliente(clienteId);
  const ids = sistemas.map((s) => s.id);
  // parcelas de sistema PAUSADO ficam suspensas (não cobradas até retomar)
  const pagamentos = aplicarSuspensao(await db.listPagamentosBySistemas(ids), sistemas);
  const melhorias = await db.listMelhoriasBySistemas(ids);
  const nome = (id: string) => sistemas.find((s) => s.id === id)?.nome ?? "";

  const hj = hoje();
  const em30 = new Date();
  em30.setDate(em30.getDate() + 30);
  const em30Str = em30.toISOString().slice(0, 10);

  // Situação financeira geral + por sistema
  const geral = resumoPagamentos(pagamentos);
  const porSistema = sistemas.map((s) => ({
    sistema: s,
    ...resumoPagamentos(pagamentos.filter((p) => p.sistema_id === s.id)),
  }));

  // Últimos pagamentos (recebidos, mais recentes primeiro)
  const ultimosPagamentos: PagComSistema[] = pagamentos
    .filter((p) => recebidoDe(p) > 0)
    .sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""))
    .map((p) => ({ ...p, sistema_nome: nome(p.sistema_id) }));

  // Em aberto (com saldo). Separa cobráveis de suspensos (sistema pausado).
  const todosAbertos: PagComSistema[] = pagamentos
    .filter((p) => saldoDe(p) > 0)
    .sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"))
    .map((p) => ({ ...p, sistema_nome: nome(p.sistema_id) }));

  const emAberto = todosAbertos.filter((p) => !p.suspenso); // cobráveis
  const suspensos = todosAbertos.filter((p) => p.suspenso); // sistema pausado

  const atrasados = emAberto.filter((p) => p.vencimento && p.vencimento < hj);
  const proximos30 = emAberto.filter(
    (p) => p.vencimento && p.vencimento >= hj && p.vencimento <= em30Str
  );
  const proximo = emAberto.find((p) => p.vencimento && p.vencimento >= hj) ?? null;

  return {
    sistemas,
    pagamentos,
    melhorias,
    geral,
    porSistema,
    ultimosPagamentos,
    emAberto,
    suspensos,
    atrasados,
    proximos30,
    proximo,
  };
}

export type ResumoCliente = Awaited<ReturnType<typeof carregarResumoCliente>>;
export type { Sistema };
