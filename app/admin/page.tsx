import Link from "next/link";
import { Card, Stat, Progress, Badge, statusBadge } from "@/components/ui";
import { brl, resumoPagamentos, aplicarSuspensao } from "@/lib/format";
import {
  criarSistema,
  adicionarTarefa,
  alternarTarefa,
  excluirTarefa,
} from "./actions";
import * as db from "@/lib/db";

const prioBadge = (p: string) =>
  p === "alta" ? (
    <Badge tone="red">Alta</Badge>
  ) : p === "baixa" ? (
    <Badge tone="gray">Baixa</Badge>
  ) : (
    <Badge tone="yellow">Média</Badge>
  );

export default async function AdminHome() {
  const sis = await db.listSistemas();
  // parcelas de sistema PAUSADO ficam suspensas (fora de "a receber"/atraso)
  const pags = aplicarSuspensao(await db.listPagamentos(), sis);
  const cls = await db.listClientes();
  // Tarefas de sistemas próprios ficam só na aba deles; aqui só as de cliente/gerais.
  const idsProprios = new Set((await db.listProprios()).map((p) => p.id));
  const tars = (await db.listTarefas()).filter(
    (t) => !t.sistema_id || !idsProprios.has(t.sistema_id)
  );

  const nomeCliente = (id: string | null) =>
    cls.find((c) => c.id === id)?.nome ?? "—";
  const nomeSistema = (id: string | null) =>
    sis.find((s) => s.id === id)?.nome ?? "Geral";

  const totalGeral = resumoPagamentos(pags);
  const mensalRecorrente = sis
    .filter((s) => s.status !== "pausado")
    .reduce((a, s) => a + Number(s.custo_mensal), 0);

  const pendentes = tars.filter((t) => !t.concluida);

  return (
    <div className="space-y-8">
      {/* Indicadores gerais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sistemas" value={String(sis.length)} />
        <Stat label="Recebido" value={brl(totalGeral.pago)} tone="green" />
        <Stat
          label="A receber"
          value={brl(totalGeral.restante)}
          tone={totalGeral.atrasado > 0 ? "red" : "default"}
          hint={
            [
              totalGeral.atrasado > 0 ? `${brl(totalGeral.atrasado)} atrasado` : null,
              totalGeral.suspenso > 0 ? `${brl(totalGeral.suspenso)} suspenso (pausado)` : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
        <Stat label="Mensal recorrente" value={brl(mensalRecorrente)} tone="blue" />
      </div>

      {/* Tarefas: o que precisa fazer */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            O que precisa fazer
          </h2>
          <Badge tone={pendentes.length ? "yellow" : "green"}>
            {pendentes.length} pendente(s)
          </Badge>
        </div>

        <Card>
          <form action={adicionarTarefa} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="label">Tarefa</label>
              <input
                name="titulo"
                required
                placeholder="Ex.: Ajustar relatório de vendas"
                className="field"
              />
            </div>
            <div>
              <label className="label">Sistema</label>
              <select
                name="sistema_id"
                className="field"
              >
                <option value="">Geral</option>
                {sis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select
                name="prioridade"
                defaultValue="media"
                className="field"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <button className="btn-primary">Adicionar</button>
          </form>

          {tars.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Nenhuma tarefa cadastrada.</p>
          ) : (
            <ul className="mt-4 divide-line">
              {tars
                .slice()
                .sort((a, b) => Number(a.concluida) - Number(b.concluida))
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                    <form action={alternarTarefa}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="concluida" value={String(t.concluida)} />
                      <input type="hidden" name="sistema_id" value={t.sistema_id ?? ""} />
                      <button
                        title={t.concluida ? "Reabrir" : "Concluir"}
                        className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          t.concluida
                            ? "border-emerald-400 bg-emerald-400 text-[#05060b]"
                            : "border-white/25"
                        }`}
                      >
                        {t.concluida ? "✓" : ""}
                      </button>
                    </form>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          t.concluida
                            ? "text-[var(--muted)] line-through"
                            : "text-[var(--text)]"
                        }`}
                      >
                        {t.titulo}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {nomeSistema(t.sistema_id)}
                      </p>
                    </div>
                    {prioBadge(t.prioridade)}
                    <form action={excluirTarefa}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="sistema_id" value={t.sistema_id ?? ""} />
                      <button className="text-[var(--muted)] transition hover:text-[var(--red)]">✕</button>
                    </form>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Sistemas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">Sistemas</h2>
          <details className="relative">
            <summary className="btn-dark cursor-pointer list-none">
              + Novo sistema
            </summary>
            <div className="card absolute right-0 z-10 mt-2 w-80 p-4">
              <form action={criarSistema} className="space-y-3">
                <input
                  name="nome"
                  required
                  placeholder="Nome do sistema"
                  className="field"
                />
                <select
                  name="cliente_id"
                  className="field"
                >
                  <option value="">Sem cliente vinculado</option>
                  {cls.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome ?? c.email}
                    </option>
                  ))}
                </select>
                <textarea
                  name="descricao"
                  placeholder="Descrição (opcional)"
                  className="field"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="valor_total"
                    type="number"
                    step="0.01"
                    placeholder="Valor total"
                    className="field"
                  />
                  <input
                    name="custo_mensal"
                    type="number"
                    step="0.01"
                    placeholder="Custo mensal"
                    className="field"
                  />
                </div>
                <input
                  name="progresso"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={0}
                  placeholder="Progresso %"
                  className="field"
                />
                <button className="btn-primary w-full">Criar sistema</button>
              </form>
            </div>
          </details>
        </div>

        {sis.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              Nenhum sistema ainda. Crie o primeiro acima.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sis.map((s) => {
              const r = resumoPagamentos(pags.filter((p) => p.sistema_id === s.id));
              return (
                <Link key={s.id} href={`/admin/sistemas/${s.id}`}>
                  <Card className="card-hover h-full">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{s.nome}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {nomeCliente(s.cliente_id)}
                        </p>
                      </div>
                      {statusBadge(s.status)}
                    </div>
                    <Progress value={s.progresso} />
                    <div className="mt-3 flex justify-between text-xs text-[var(--muted)]">
                      <span>
                        Recebido:{" "}
                        <span className="tnum font-semibold text-[var(--green)]">
                          {brl(r.pago)}
                        </span>
                      </span>
                      <span>
                        Falta:{" "}
                        <span
                          className={`tnum font-semibold ${
                            r.atrasado > 0 ? "text-[var(--red)]" : "text-[var(--text)]"
                          }`}
                        >
                          {brl(r.restante)}
                        </span>
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
