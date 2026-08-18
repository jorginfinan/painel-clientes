import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Card, Stat, Progress, statusBadge } from "@/components/ui";
import { Voltar } from "@/components/Voltar";
import { brl } from "@/lib/format";
import { carregarResumoCliente } from "@/lib/resumo-cliente";

export default async function FinanceiroPage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  const r = await carregarResumoCliente(u.id);

  const custoMensal = r.sistemas.reduce((a, s) => a + Number(s.custo_mensal), 0);

  return (
    <>
      <Voltar />
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Situação financeira</h1>
        <p className="text-sm text-[var(--muted)]">
          Visão geral e por sistema de tudo que foi pago e do que ainda está em aberto.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total pago" value={brl(r.geral.pago)} tone="green" />
        <Stat
          label="Em aberto"
          value={brl(r.geral.restante)}
          tone={r.geral.atrasado > 0 ? "red" : "default"}
          hint={r.geral.atrasado > 0 ? `${brl(r.geral.atrasado)} em atraso` : undefined}
        />
        <Stat label="Valor total" value={brl(r.geral.total)} />
        <Stat label="Custo mensal" value={brl(custoMensal)} tone="blue" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Por sistema</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {r.porSistema.map(({ sistema: s, pago, restante, atrasado, suspenso, total }) => {
            const pct = total > 0 ? Math.round((pago / total) * 100) : 0;
            const pausado = s.status === "pausado";
            return (
              <Card key={s.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="font-semibold text-[var(--text)]">{s.nome}</p>
                  {statusBadge(s.status)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Pago</p>
                    <p className="tnum font-bold text-[var(--green)]">{brl(pago)}</p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">
                      {pausado ? "Suspenso" : "Em aberto"}
                    </p>
                    <p className={`tnum font-bold ${atrasado > 0 ? "text-[var(--red)]" : pausado ? "text-amber-300" : "text-[var(--text)]"}`}>
                      {brl(pausado ? suspenso : restante)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">Total</p>
                    <p className="tnum font-bold text-[var(--text)]">{brl(total)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="uppercase tracking-wide text-[var(--muted)]">Pago do total</span>
                    <span className="tnum font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(52,211,153,0.6)" }}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={s.progresso} />
                </div>
                {atrasado > 0 && (
                  <p className="mt-2 text-xs text-[var(--red)]">{brl(atrasado)} em atraso</p>
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Custo mensal:{" "}
                  <span className="tnum font-semibold text-cyan-300">{brl(s.custo_mensal)}</span>
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
