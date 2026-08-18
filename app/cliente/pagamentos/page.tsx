import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Card, Stat, Badge } from "@/components/ui";
import { Voltar } from "@/components/Voltar";
import { brl, dataBR, recebidoDe, saldoDe } from "@/lib/format";
import { carregarResumoCliente } from "@/lib/resumo-cliente";

export default async function PagamentosPage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  const r = await carregarResumoCliente(u.id);

  // agrupa por mês do pagamento
  const grupos = new Map<string, typeof r.ultimosPagamentos>();
  for (const p of r.ultimosPagamentos) {
    const k = (p.data_pagamento ?? "").slice(0, 7) || "sem-data";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(p);
  }
  const mesLabel = (k: string) => {
    if (k === "sem-data") return "Sem data";
    const [a, m] = k.split("-");
    return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <>
      <Voltar />
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Pagamentos realizados</h1>
        <p className="text-sm text-[var(--muted)]">
          Histórico de tudo que você já pagou, do mais recente pro mais antigo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Total pago" value={brl(r.geral.pago)} tone="green" />
        <Stat label="Pagamentos" value={String(r.ultimosPagamentos.length)} />
        <Stat
          label="Último pagamento"
          value={r.ultimosPagamentos[0] ? dataBR(r.ultimosPagamentos[0].data_pagamento) : "—"}
        />
      </div>

      {r.ultimosPagamentos.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Nenhum pagamento registrado ainda.</p>
        </Card>
      ) : (
        [...grupos.entries()].map(([k, lista]) => (
          <section key={k} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
                {mesLabel(k)}
              </h2>
              <span className="tnum text-sm font-semibold text-[var(--green)]">
                {brl(lista.reduce((a, p) => a + recebidoDe(p), 0))}
              </span>
            </div>
            <Card>
              <ul className="divide-line">
                {lista.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-[var(--text)]">{p.descricao}</p>
                      <p className="tnum text-xs text-[var(--muted)]">
                        {p.sistema_nome} · pago em {dataBR(p.data_pagamento)}
                        {saldoDe(p) > 0 ? ` · parcial (falta ${brl(saldoDe(p))})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum font-semibold text-[var(--green)]">
                        {brl(recebidoDe(p))}
                      </span>
                      <Badge tone={saldoDe(p) > 0 ? "yellow" : "green"}>
                        {saldoDe(p) > 0 ? "Parcial" : "Pago"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </>
  );
}
