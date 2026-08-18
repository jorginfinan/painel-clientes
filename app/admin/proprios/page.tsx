import Link from "next/link";
import { Card, Stat, Progress, Badge } from "@/components/ui";
import { brl } from "@/lib/format";
import { criarProprio } from "../actions";
import * as db from "@/lib/db";

export const statusProprio = (s: string) => {
  if (s === "no_ar") return <Badge tone="green">No ar</Badge>;
  if (s === "pausado") return <Badge tone="yellow">Pausado</Badge>;
  return <Badge tone="blue">Em desenvolvimento</Badge>;
};

const inp = "field";

export default async function PropriosPage() {
  const proprios = await db.listProprios();

  const custoTotal = proprios.reduce((a, p) => a + Number(p.custo_mensal), 0);
  const receitaTotal = proprios.reduce((a, p) => a + Number(p.receita_mensal), 0);
  const lucro = receitaTotal - custoTotal;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Sistemas próprios</h1>
        <p className="text-sm text-[var(--muted)]">
          Os produtos e projetos da Koryva — separados dos sistemas de cliente.
        </p>
      </div>

      {/* Finanças mensais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sistemas próprios" value={String(proprios.length)} />
        <Stat label="Receita mensal" value={brl(receitaTotal)} tone="green" />
        <Stat label="Custo mensal" value={brl(custoTotal)} tone="red" />
        <Stat
          label="Lucro mensal"
          value={brl(lucro)}
          tone={lucro >= 0 ? "blue" : "red"}
        />
      </div>

      {/* Novo sistema próprio */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Meus sistemas
          </h2>
          <details className="relative">
            <summary className="btn-dark cursor-pointer list-none">
              + Novo sistema próprio
            </summary>
            <div className="card absolute right-0 z-10 mt-2 w-80 p-4">
              <form action={criarProprio} className="space-y-3">
                <input name="nome" required placeholder="Nome do sistema" className={inp} />
                <textarea
                  name="descricao"
                  placeholder="Descrição (opcional)"
                  className={inp}
                />
                <select name="status" defaultValue="desenvolvimento" className={inp}>
                  <option value="desenvolvimento">Em desenvolvimento</option>
                  <option value="no_ar">No ar</option>
                  <option value="pausado">Pausado</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="receita_mensal"
                    type="number"
                    step="0.01"
                    placeholder="Receita/mês"
                    className={inp}
                  />
                  <input
                    name="custo_mensal"
                    type="number"
                    step="0.01"
                    placeholder="Custo/mês"
                    className={inp}
                  />
                </div>
                <input
                  name="progresso"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={0}
                  placeholder="Progresso %"
                  className={inp}
                />
                <button className="btn-primary w-full">Criar</button>
              </form>
            </div>
          </details>
        </div>

        {proprios.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              Nenhum sistema próprio ainda. Cadastre o primeiro acima (ex.: LDP,
              Tracefy, Bingo).
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {proprios.map((p) => {
              const l = Number(p.receita_mensal) - Number(p.custo_mensal);
              return (
                <Link key={p.id} href={`/admin/proprios/${p.id}`}>
                  <Card className="card-hover h-full">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{p.nome}</p>
                        {p.descricao && (
                          <p className="line-clamp-1 text-xs text-[var(--muted)]">
                            {p.descricao}
                          </p>
                        )}
                      </div>
                      {statusProprio(p.status)}
                    </div>
                    <Progress value={p.progresso} />
                    <div className="mt-3 flex justify-between text-xs text-[var(--muted)]">
                      <span>
                        Receita:{" "}
                        <span className="tnum font-semibold text-[var(--green)]">
                          {brl(p.receita_mensal)}
                        </span>
                      </span>
                      <span>
                        Lucro:{" "}
                        <span
                          className={`tnum font-semibold ${
                            l >= 0 ? "text-[var(--text)]" : "text-[var(--red)]"
                          }`}
                        >
                          {brl(l)}
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
