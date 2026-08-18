import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Card, Progress, Badge, statusBadge } from "@/components/ui";
import { brl, dataBR, recebidoDe, saldoDe } from "@/lib/format";
import { carregarResumoCliente } from "@/lib/resumo-cliente";

function CardResumo({
  href,
  titulo,
  children,
  destaque,
}: {
  href: string;
  titulo: string;
  children: React.ReactNode;
  destaque?: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <Card className="card-hover flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--text)]">{titulo}</h3>
          <span className="text-xs text-cyan-300">ver detalhes →</span>
        </div>
        {destaque}
        <div className="mt-3 flex-1">{children}</div>
      </Card>
    </Link>
  );
}

export default async function ClientePage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");

  const r = await carregarResumoCliente(u.id);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          Olá, {u.nome} <span className="neon">👋</span>
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Resumo dos seus sistemas. Clique em qualquer card pra ver os detalhes.
        </p>
      </div>

      {r.sistemas.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum sistema vinculado à sua conta ainda.
          </p>
        </Card>
      )}

      {r.sistemas.length > 0 && (
        <>
          {/* 3 resumos clicáveis */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Situação financeira */}
            <CardResumo
              href="/cliente/financeiro"
              titulo="Situação financeira"
              destaque={
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">
                      Pago
                    </p>
                    <p className="tnum text-xl font-bold text-[var(--green)]">
                      {brl(r.geral.pago)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">
                      Em aberto
                    </p>
                    <p
                      className={`tnum text-xl font-bold ${
                        r.geral.atrasado > 0 ? "text-[var(--red)]" : "text-[var(--text)]"
                      }`}
                    >
                      {brl(r.geral.restante)}
                    </p>
                  </div>
                </div>
              }
            >
              <ul className="space-y-1.5 text-xs">
                {r.porSistema.map(({ sistema, pago, restante }) => (
                  <li key={sistema.id} className="flex justify-between gap-2">
                    <span className="truncate text-[var(--muted)]">{sistema.nome}</span>
                    <span className="tnum shrink-0">
                      <span className="text-[var(--green)]">{brl(pago)}</span>
                      <span className="text-[var(--muted)]"> / </span>
                      <span className="text-[var(--text)]">{brl(restante)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {r.geral.atrasado > 0 && (
                <p className="mt-2 text-xs text-[var(--red)]">
                  {brl(r.geral.atrasado)} em atraso
                </p>
              )}
              {r.geral.suspenso > 0 && (
                <p className="mt-1 text-xs text-amber-300">
                  ⏸ {brl(r.geral.suspenso)} suspenso (sistema pausado)
                </p>
              )}
            </CardResumo>

            {/* Últimos pagamentos */}
            <CardResumo
              href="/cliente/pagamentos"
              titulo="Últimos pagamentos"
              destaque={
                <p className="tnum text-xl font-bold text-[var(--green)]">
                  {r.ultimosPagamentos.length}{" "}
                  <span className="text-sm font-normal text-[var(--muted)]">
                    pagamento{r.ultimosPagamentos.length === 1 ? "" : "s"}
                  </span>
                </p>
              }
            >
              {r.ultimosPagamentos.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">Nenhum pagamento ainda.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {r.ultimosPagamentos.slice(0, 4).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate text-[var(--muted)]">
                        {dataBR(p.data_pagamento)} · {p.descricao}
                      </span>
                      <span className="tnum shrink-0 font-semibold text-[var(--green)]">
                        {brl(recebidoDe(p))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardResumo>

            {/* Vencimentos próximos */}
            <CardResumo
              href="/cliente/vencimentos"
              titulo="Vencimentos próximos"
              destaque={
                r.proximo ? (
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted)]">
                      Próximo · {dataBR(r.proximo.vencimento)}
                    </p>
                    <p className="tnum text-xl font-bold text-[var(--text)]">
                      {brl(saldoDe(r.proximo))}
                    </p>
                  </div>
                ) : r.atrasados.length > 0 ? (
                  <p className="text-xl font-bold text-[var(--red)]">Em atraso</p>
                ) : (
                  <p className="text-xl font-bold text-[var(--green)]">Tudo em dia ✅</p>
                )
              }
            >
              {r.atrasados.length > 0 && (
                <p className="mb-1.5 text-xs text-[var(--red)]">
                  {r.atrasados.length} atrasado{r.atrasados.length === 1 ? "" : "s"} ·{" "}
                  {brl(r.atrasados.reduce((a, p) => a + saldoDe(p), 0))}
                </p>
              )}
              {r.proximos30.length > 0 ? (
                <ul className="space-y-1.5 text-xs">
                  {r.proximos30.slice(0, 4).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate text-[var(--muted)]">
                        {dataBR(p.vencimento)} · {p.descricao}
                      </span>
                      <span className="tnum shrink-0 font-semibold text-[var(--text)]">
                        {brl(saldoDe(p))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Nada vencendo nos próximos 30 dias.
                </p>
              )}
            </CardResumo>
          </div>

          {/* Progresso dos sistemas */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text)]">Seus sistemas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {r.sistemas.map((s) => (
                <Link key={s.id} href={`/cliente/sistema/${s.id}`}>
                  <Card className="card-hover h-full">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{s.nome}</p>
                        {s.descricao && (
                          <p className="line-clamp-1 text-xs text-[var(--muted)]">
                            {s.descricao}
                          </p>
                        )}
                      </div>
                      {statusBadge(s.status)}
                    </div>
                    <Progress value={s.progresso} />
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>
                        Custo mensal:{" "}
                        <span className="tnum font-semibold text-cyan-300">
                          {brl(s.custo_mensal)}
                        </span>
                      </span>
                      <span className="text-cyan-300">o que já foi feito →</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
