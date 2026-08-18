import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Stat, Progress, Badge } from "@/components/ui";
import { PlanoForm } from "@/components/PlanoForm";
import {
  brl,
  dataBR,
  hoje,
  resumoPagamentos,
  recebidoDe,
  saldoDe,
  estadoPag,
  aplicarSuspensao,
} from "@/lib/format";
import {
  atualizarSistema,
  excluirSistema,
  adicionarPagamento,
  registrarRecebimento,
  quitarPagamento,
  estornarPagamento,
  excluirPagamento,
  adicionarMelhoria,
  excluirMelhoria,
  adicionarTarefa,
  alternarTarefa,
  excluirTarefa,
} from "../../actions";
import * as db from "@/lib/db";

const inp = "field";

export default async function SistemaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const s = await db.getSistema(id);
  if (!s) notFound();

  const cls = await db.listClientes();
  // sistema PAUSADO -> parcelas em aberto ficam suspensas (não cobradas)
  const pags = aplicarSuspensao(await db.listPagamentosBySistema(id), [s]);
  const melhs = await db.listMelhoriasBySistema(id);
  const tars = await db.listTarefasBySistema(id);
  const r = resumoPagamentos(pags);
  const pausado = s.status === "pausado";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-cyan-300 transition hover:text-cyan-200">
          ← Voltar
        </Link>
        <form action={excluirSistema}>
          <input type="hidden" name="id" value={s.id} />
          <button className="text-sm text-[var(--red)] transition hover:brightness-110">
            Excluir sistema
          </button>
        </form>
      </div>

      {pausado && (
        <div className="chip-amber rounded-xl px-4 py-3 text-sm">
          ⏸ <strong>Sistema pausado</strong> — a cobrança está suspensa. As parcelas em
          aberto ({brl(r.suspenso)}) não contam como "a receber", não entram em atraso
          nem no lembrete de WhatsApp. Ao voltar pra <em>Em andamento</em>, tudo volta
          a valer normalmente.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Recebido" value={brl(r.pago)} tone="green" />
        <Stat
          label={pausado ? "Suspenso (pausado)" : "A receber"}
          value={brl(pausado ? r.suspenso : r.restante)}
          tone={r.atrasado > 0 ? "red" : "default"}
          hint={r.atrasado > 0 ? `${brl(r.atrasado)} atrasado` : undefined}
        />
        <Stat label="Custo mensal" value={brl(s.custo_mensal)} tone="blue" />
        <Stat label="Progresso" value={`${s.progresso}%`} />
      </div>

      {/* Editar sistema */}
      <Card>
        <h2 className="mb-3 font-semibold text-[var(--text)]">Dados do sistema</h2>
        <form action={atualizarSistema} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={s.id} />
          <div>
            <label className="label">Nome</label>
            <input name="nome" defaultValue={s.nome} required className={inp} />
          </div>
          <div>
            <label className="label">Cliente</label>
            <select name="cliente_id" defaultValue={s.cliente_id ?? ""} className={inp}>
              <option value="">Sem cliente vinculado</option>
              {cls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? c.email}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <textarea name="descricao" defaultValue={s.descricao ?? ""} className={inp} />
          </div>
          <div>
            <label className="label">Valor total (R$)</label>
            <input name="valor_total" type="number" step="0.01" defaultValue={s.valor_total} className={inp} />
          </div>
          <div>
            <label className="label">Custo mensal (R$)</label>
            <input name="custo_mensal" type="number" step="0.01" defaultValue={s.custo_mensal} className={inp} />
          </div>
          <div>
            <label className="label">Progresso (%)</label>
            <input name="progresso" type="number" min="0" max="100" defaultValue={s.progresso} className={inp} />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={s.status} className={inp}>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Progress value={s.progresso} />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary">
              Salvar alterações
            </button>
          </div>
        </form>
      </Card>

      {/* Pagamentos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Pagamentos</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
              Plano de pagamento
            </h3>
            <PlanoForm
              sistemaId={s.id}
              valorTotalInicial={s.valor_total}
              hoje={hoje()}
            />
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
              Lançar pagamento avulso / mensalidade
            </h3>
            <form action={adicionarPagamento} className="space-y-2">
              <input type="hidden" name="sistema_id" value={s.id} />
              <input name="descricao" required placeholder="Descrição (ex.: Mensalidade Junho)" className={inp} />
              <div className="grid grid-cols-2 gap-2">
                <input name="valor" type="number" step="0.01" placeholder="Valor" required className={inp} />
                <select name="tipo" defaultValue="avulso" className={inp}>
                  <option value="avulso">Avulso</option>
                  <option value="mensalidade">Mensalidade</option>
                  <option value="parcela">Parcela</option>
                </select>
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input name="vencimento" type="date" defaultValue={hoje()} className={inp} />
              </div>
              <button className="btn-primary w-full">Adicionar lançamento</button>
            </form>
          </Card>
        </div>

        <Card>
          {pags.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhum pagamento lançado.</p>
          ) : (
            <ul className="divide-line">
              {pags
                .slice()
                .sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""))
                .map((p) => {
                  const estado = estadoPag(p);
                  const receb = recebidoDe(p);
                  const saldo = saldoDe(p);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-medium text-[var(--text)]">{p.descricao}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {p.tipo} ·{" "}
                          {p.vencimento
                            ? `venc. ${dataBR(p.vencimento)}`
                            : "na conclusão"}
                          {receb > 0 && p.data_pagamento
                            ? ` · últ. baixa ${dataBR(p.data_pagamento)}`
                            : ""}
                        </p>
                        {estado === "parcial" && (
                          <p className="tnum mt-0.5 text-xs text-amber-300">
                            recebido {brl(receb)} · falta {brl(saldo)}
                          </p>
                        )}
                      </div>

                      <span className="tnum font-semibold text-[var(--text)]">
                        {brl(p.valor)}
                      </span>

                      {estado === "pago" ? (
                        <Badge tone="green">Pago</Badge>
                      ) : estado === "suspenso" ? (
                        <Badge tone="gray">⏸ Suspenso</Badge>
                      ) : estado === "parcial" ? (
                        <Badge tone="yellow">Parcial</Badge>
                      ) : estado === "atrasado" ? (
                        <Badge tone="red">Atrasado</Badge>
                      ) : estado === "conclusao" ? (
                        <Badge tone="blue">Na conclusão</Badge>
                      ) : (
                        <Badge tone="yellow">A pagar</Badge>
                      )}

                      {estado !== "pago" && (
                        <>
                          {/* baixa parcial: quanto recebeu + em que data */}
                          <form
                            action={registrarRecebimento}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="sistema_id" value={s.id} />
                            <input
                              name="valor"
                              type="number"
                              step="0.01"
                              min="0"
                              max={saldo}
                              placeholder={`baixa (falta ${brl(saldo)})`}
                              className="field w-36 py-1 text-xs"
                            />
                            <input
                              name="data_pagamento"
                              type="date"
                              defaultValue={hoje()}
                              title="Data do pagamento"
                              className="field w-36 py-1 text-xs"
                            />
                            <button className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-[var(--text)] transition hover:border-cyan-400/50 hover:bg-white/10">
                              Registrar
                            </button>
                          </form>
                          {/* quitar tudo de uma vez, na data informada */}
                          <form action={quitarPagamento} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="sistema_id" value={s.id} />
                            <input
                              name="data_pagamento"
                              type="date"
                              defaultValue={hoje()}
                              title="Data do pagamento"
                              className="field w-36 py-1 text-xs"
                            />
                            <button className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/20">
                              Quitar
                            </button>
                          </form>
                        </>
                      )}

                      {receb > 0 && (
                        <form action={estornarPagamento}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="sistema_id" value={s.id} />
                          <button className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]">
                            Estornar
                          </button>
                        </form>
                      )}

                      <form action={excluirPagamento}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="sistema_id" value={s.id} />
                        <button className="text-[var(--muted)] transition hover:text-[var(--red)]">✕</button>
                      </form>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      </section>

      {/* Melhorias */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          O que já foi feito <span className="text-sm font-normal text-[var(--muted)]">(entregas)</span>
        </h2>
        <Card>
          <form action={adicionarMelhoria} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sistema_id" value={s.id} />
            <div className="flex-1 min-w-[180px]">
              <label className="label">Título</label>
              <input name="titulo" required placeholder="Ex.: Novo relatório de caixa" className={inp} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label">Detalhe (opcional)</label>
              <input name="descricao" className={inp} />
            </div>
            <div>
              <label className="label">Data</label>
              <input name="data" type="date" defaultValue={hoje()} className={inp} />
            </div>
            <button className="btn-primary">
              Adicionar
            </button>
          </form>

          {melhs.length > 0 && (
            <ul className="mt-4 divide-line">
              {melhs.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--text)]">{m.titulo}</p>
                    {m.descricao && <p className="text-[var(--muted)]">{m.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-xs text-[var(--muted)]">{dataBR(m.data)}</span>
                    <form action={excluirMelhoria}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="sistema_id" value={s.id} />
                      <button className="text-[var(--muted)] transition hover:text-[var(--red)]">✕</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Tarefas do sistema */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Tarefas deste sistema
        </h2>
        <Card>
          <form action={adicionarTarefa} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sistema_id" value={s.id} />
            <div className="flex-1 min-w-[180px]">
              <label className="label">Tarefa</label>
              <input name="titulo" required className={inp} />
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select name="prioridade" defaultValue="media" className={inp}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <button className="btn-primary">
              Adicionar
            </button>
          </form>

          {tars.length > 0 && (
            <ul className="mt-4 divide-line">
              {tars
                .slice()
                .sort((a, b) => Number(a.concluida) - Number(b.concluida))
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                    <form action={alternarTarefa}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="concluida" value={String(t.concluida)} />
                      <input type="hidden" name="sistema_id" value={s.id} />
                      <button
                        className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          t.concluida
                            ? "border-emerald-400 bg-emerald-400 text-[#05060b]"
                            : "border-white/25"
                        }`}
                      >
                        {t.concluida ? "✓" : ""}
                      </button>
                    </form>
                    <span
                      className={`flex-1 font-medium ${
                        t.concluida
                          ? "text-[var(--muted)] line-through"
                          : "text-[var(--text)]"
                      }`}
                    >
                      {t.titulo}
                    </span>
                    <form action={excluirTarefa}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="sistema_id" value={s.id} />
                      <button className="text-[var(--muted)] transition hover:text-[var(--red)]">✕</button>
                    </form>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
