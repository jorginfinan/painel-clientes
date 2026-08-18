import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Stat, Progress } from "@/components/ui";
import { statusProprio } from "../page";
import { brl, dataBR, hoje } from "@/lib/format";
import {
  atualizarProprio,
  excluirProprio,
  adicionarMelhoria,
  excluirMelhoria,
  adicionarTarefa,
  alternarTarefa,
  excluirTarefa,
} from "../../actions";
import * as db from "@/lib/db";

const inp = "field";

export default async function ProprioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await db.getProprio(id);
  if (!p) notFound();

  const melhs = await db.listMelhoriasBySistema(id);
  const tars = await db.listTarefasBySistema(id);
  const lucro = Number(p.receita_mensal) - Number(p.custo_mensal);

  const links: { rot: string; url: string }[] = [];
  if (p.url) links.push({ rot: "Abrir sistema", url: p.url });
  if (p.repositorio) links.push({ rot: "Repositório", url: p.repositorio });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/proprios"
          className="text-sm text-cyan-300 transition hover:text-cyan-200"
        >
          ← Voltar
        </Link>
        <form action={excluirProprio}>
          <input type="hidden" name="id" value={p.id} />
          <button className="text-sm text-[var(--red)] transition hover:brightness-110">
            Excluir sistema
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text)]">{p.nome}</h1>
        {statusProprio(p.status)}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Receita mensal" value={brl(p.receita_mensal)} tone="green" />
        <Stat label="Custo mensal" value={brl(p.custo_mensal)} tone="red" />
        <Stat
          label="Lucro mensal"
          value={brl(lucro)}
          tone={lucro >= 0 ? "blue" : "red"}
        />
        <Stat label="Progresso" value={`${p.progresso}%`} />
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.rot}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
            >
              {l.rot} ↗
            </a>
          ))}
        </div>
      )}

      {/* Editar */}
      <Card>
        <h2 className="mb-3 font-semibold text-[var(--text)]">Dados do sistema</h2>
        <form action={atualizarProprio} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <div>
            <label className="label">Nome</label>
            <input name="nome" defaultValue={p.nome} required className={inp} />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={p.status} className={inp}>
              <option value="desenvolvimento">Em desenvolvimento</option>
              <option value="no_ar">No ar</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <textarea name="descricao" defaultValue={p.descricao ?? ""} className={inp} />
          </div>
          <div>
            <label className="label">Receita mensal (R$)</label>
            <input name="receita_mensal" type="number" step="0.01" defaultValue={p.receita_mensal} className={inp} />
          </div>
          <div>
            <label className="label">Custo mensal (R$)</label>
            <input name="custo_mensal" type="number" step="0.01" defaultValue={p.custo_mensal} className={inp} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Progresso (%)</label>
            <input name="progresso" type="number" min="0" max="100" defaultValue={p.progresso} className={inp} />
          </div>

          <div className="md:col-span-2 mt-1 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
              Infos técnicas
            </p>
          </div>
          <div>
            <label className="label">URL do sistema</label>
            <input name="url" defaultValue={p.url ?? ""} placeholder="https://..." className={inp} />
          </div>
          <div>
            <label className="label">Repositório</label>
            <input name="repositorio" defaultValue={p.repositorio ?? ""} placeholder="https://github.com/..." className={inp} />
          </div>
          <div>
            <label className="label">Servidor / hospedagem</label>
            <input name="servidor" defaultValue={p.servidor ?? ""} placeholder="Ex.: VPS Hostinger, Vercel..." className={inp} />
          </div>
          <div>
            <label className="label">Observações</label>
            <input name="observacoes" defaultValue={p.observacoes ?? ""} className={inp} />
          </div>

          <div className="md:col-span-2">
            <Progress value={p.progresso} />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary">Salvar alterações</button>
          </div>
        </form>
      </Card>

      {p.observacoes && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Observações</h3>
          <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{p.observacoes}</p>
        </Card>
      )}

      {/* O que já foi feito */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          O que já foi feito{" "}
          <span className="text-sm font-normal text-[var(--muted)]">(entregas)</span>
        </h2>
        <Card>
          <form action={adicionarMelhoria} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sistema_id" value={p.id} />
            <input type="hidden" name="origem" value="proprio" />
            <div className="flex-1 min-w-[180px]">
              <label className="label">Título</label>
              <input name="titulo" required placeholder="Ex.: Deploy da v2" className={inp} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label">Detalhe (opcional)</label>
              <input name="descricao" className={inp} />
            </div>
            <div>
              <label className="label">Data</label>
              <input name="data" type="date" defaultValue={hoje()} className={inp} />
            </div>
            <button className="btn-primary">Adicionar</button>
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
                      <input type="hidden" name="sistema_id" value={p.id} />
                      <input type="hidden" name="origem" value="proprio" />
                      <button className="text-[var(--muted)] transition hover:text-[var(--red)]">✕</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Tarefas internas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Tarefas internas
        </h2>
        <Card>
          <form action={adicionarTarefa} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sistema_id" value={p.id} />
            <input type="hidden" name="origem" value="proprio" />
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
            <button className="btn-primary">Adicionar</button>
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
                      <input type="hidden" name="sistema_id" value={p.id} />
                      <input type="hidden" name="origem" value="proprio" />
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
                      <input type="hidden" name="sistema_id" value={p.id} />
                      <input type="hidden" name="origem" value="proprio" />
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
