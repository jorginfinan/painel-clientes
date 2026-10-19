import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Card, Stat, Progress, Badge, statusBadge } from "@/components/ui";
import { Voltar } from "@/components/Voltar";
import {
  brl,
  dataBR,
  hoje,
  recebidoDe,
  saldoDe,
  resumoPagamentos,
  aplicarSuspensao,
} from "@/lib/format";
import * as db from "@/lib/db";

export default async function SistemaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  const { id } = await params;

  const s = await db.getSistema(id);
  // segurança: só o dono vê
  if (!s || s.cliente_id !== u.id) notFound();

  const pags = aplicarSuspensao(await db.listPagamentosBySistema(id), [s]);
  const melhs = await db.listMelhoriasBySistema(id);
  const renegs = await db.listRenegociacoesBySistema(id);
  const r = resumoPagamentos(pags);
  const hj = hoje();
  const pausado = s.status === "pausado";

  const recebidos = pags
    .filter((p) => recebidoDe(p) > 0)
    .sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""));
  const aPagar = pags
    .filter((p) => saldoDe(p) > 0)
    .sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"));

  return (
    <>
      <Voltar />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text)]">{s.nome}</h1>
        {statusBadge(s.status)}
      </div>
      {s.descricao && <p className="text-sm text-[var(--muted)]">{s.descricao}</p>}

      {pausado && (
        <div className="chip-amber rounded-xl px-4 py-3 text-sm">
          ⏸ Este sistema está <strong>pausado</strong>. As parcelas em aberto ficam com a
          cobrança suspensa até o trabalho ser retomado — não geram atraso.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total pago" value={brl(r.pago)} tone="green" />
        <Stat
          label={pausado ? "Suspenso" : "Em aberto"}
          value={brl(pausado ? r.suspenso : r.restante)}
          tone={r.atrasado > 0 ? "red" : "default"}
          hint={r.atrasado > 0 ? `${brl(r.atrasado)} em atraso` : undefined}
        />
        <Stat label="Valor total" value={brl(r.total || s.valor_total)} />
        <Stat label="Custo mensal" value={brl(s.custo_mensal)} tone="blue" />
      </div>

      <Card>
        <Progress value={s.progresso} />
      </Card>

      {renegs.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold text-[var(--text)]">↻ Renegociação</h3>
          <ul className="space-y-1.5 text-sm">
            {renegs.map((rn) => (
              <li key={rn.id} className="text-[var(--muted)]">
                Em <span className="tnum text-[var(--text)]">{dataBR(rn.created_at.slice(0, 10))}</span> o saldo
                de <span className="tnum text-[var(--text)]">{brl(rn.valor_aberto)}</span> foi renegociado para{" "}
                <span className="tnum font-semibold text-[var(--text)]">{brl(rn.valor_novo)}</span>
                {rn.entrada > 0 ? <> com entrada de <span className="tnum">{brl(rn.entrada)}</span></> : null}
                {rn.num_parcelas > 0 ? (
                  <>
                    {" "}em <span className="tnum">{rn.num_parcelas}×</span> de{" "}
                    <span className="tnum">{brl((rn.valor_novo - rn.entrada) / rn.num_parcelas)}</span>
                  </>
                ) : null}
                .
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* O que já foi feito */}
        <Card>
          <h3 className="mb-3 font-semibold text-[var(--text)]">O que já foi feito</h3>
          {melhs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nada por aqui ainda.</p>
          ) : (
            <ul className="space-y-3">
              {melhs.map((m) => (
                <li key={m.id} className="relative border-l border-white/10 pl-4 text-sm">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text)]">{m.titulo}</p>
                    <span className="tnum shrink-0 text-xs text-[var(--muted)]">{dataBR(m.data)}</span>
                  </div>
                  {m.descricao && <p className="text-[var(--muted)]">{m.descricao}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">Pagamentos recebidos</h3>
              <span className="tnum text-sm font-semibold text-[var(--green)]">{brl(r.pago)}</span>
            </div>
            {recebidos.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhum pagamento ainda.</p>
            ) : (
              <ul className="divide-line">
                {recebidos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-[var(--text)]">{p.descricao}</p>
                      <p className="tnum text-xs text-[var(--muted)]">
                        Pago em {dataBR(p.data_pagamento)}
                        {saldoDe(p) > 0 ? ` · parcial (falta ${brl(saldoDe(p))})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum font-semibold text-[var(--green)]">{brl(recebidoDe(p))}</span>
                      <Badge tone={saldoDe(p) > 0 ? "yellow" : "green"}>{saldoDe(p) > 0 ? "Parcial" : "Pago"}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[var(--text)]">A pagar</h3>
              <span className={`tnum text-sm font-semibold ${r.atrasado > 0 ? "text-[var(--red)]" : "text-[var(--text)]"}`}>
                {brl(r.restante)}
              </span>
            </div>
            {aPagar.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Tudo em dia. ✅</p>
            ) : (
              <ul className="divide-line">
                {aPagar.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-[var(--text)]">{p.descricao}</p>
                      <p className="tnum text-xs text-[var(--muted)]">
                        {p.vencimento ? `Venc.: ${dataBR(p.vencimento)}` : "Na conclusão do sistema"}
                        {recebidoDe(p) > 0 ? ` · já pago ${brl(recebidoDe(p))}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum font-semibold text-[var(--text)]">{brl(saldoDe(p))}</span>
                      {p.suspenso ? (
                        <Badge tone="gray">⏸ Suspenso</Badge>
                      ) : p.vencimento && p.vencimento < hj ? (
                        <Badge tone="red">Atrasado</Badge>
                      ) : !p.vencimento ? (
                        <Badge tone="blue">Na conclusão</Badge>
                      ) : (
                        <Badge tone="yellow">A pagar</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
