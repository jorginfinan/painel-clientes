import Link from "next/link";
import { Card, Stat, Badge } from "@/components/ui";
import { BotaoLembrete } from "@/components/BotaoLembrete";
import { brl, dataBR, hoje } from "@/lib/format";
import { montarFilaHoje, montarProximos, type TipoLembrete } from "@/lib/lembrete";
import * as db from "@/lib/db";

const tituloTipo: Record<TipoLembrete, string> = {
  atraso: "Atrasados",
  dia: "Vencem hoje",
  aviso3: "Vencem em 3 dias (aviso da semana)",
};
const badgeTipo = (t: TipoLembrete) =>
  t === "atraso" ? (
    <Badge tone="red">Atrasado</Badge>
  ) : t === "dia" ? (
    <Badge tone="yellow">Vence hoje</Badge>
  ) : (
    <Badge tone="blue">Em 3 dias</Badge>
  );

export default async function LembretesPage() {
  const clientes = await db.listClientes();
  const sistemas = await db.listSistemas();
  const pagamentos = await db.listPagamentos();
  const enviados = await db.listLembretes();
  const hj = hoje();

  const fila = montarFilaHoje(clientes, sistemas, pagamentos);
  const proximos = montarProximos(clientes, sistemas, pagamentos, 14);

  const jaEnviado = (pagamentoId: string, tipo: TipoLembrete, tel: string) =>
    enviados.some(
      (l) => l.pagamento_id === pagamentoId && l.tipo === tipo && l.telefone === tel && l.data === hj
    );

  const grupos: TipoLembrete[] = ["atraso", "dia", "aviso3"];
  const totalPendentes = fila.filter(
    (i) => i.telefones.length > 0 && !i.telefones.every((t) => jaEnviado(i.pagamentoId, i.tipo, t))
  ).length;
  const semTelefone = fila.filter((i) => i.telefones.length === 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Lembretes de hoje</h1>
        <p className="text-sm text-[var(--muted)]">
          {dataBR(hj)} · calculado automaticamente: <strong>3 dias antes</strong>, <strong>no dia</strong> e{" "}
          <strong>atrasados</strong>, sempre da parcela mais próxima de cada sistema. Sistemas pausados ficam de fora.
          Clique no número → abre o WhatsApp com a mensagem pronta e marca como enviado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Na fila hoje" value={String(fila.length)} />
        <Stat label="Pendentes de envio" value={String(totalPendentes)} tone={totalPendentes ? "red" : "green"} />
        <Stat label="Atrasados" value={String(fila.filter((i) => i.tipo === "atraso").length)} tone="red" />
        <Stat
          label="Sem WhatsApp"
          value={String(semTelefone)}
          hint={semTelefone ? "cadastre em Clientes" : undefined}
        />
      </div>

      {fila.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--green)]">
            Nada pra lembrar hoje. ✅ Veja abaixo o que vem nos próximos dias.
          </p>
        </Card>
      )}

      {grupos.map((tipo) => {
        const itens = fila.filter((i) => i.tipo === tipo);
        if (itens.length === 0) return null;
        return (
          <section key={tipo} className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {tituloTipo[tipo]}{" "}
              <span className="text-sm font-normal text-[var(--muted)]">({itens.length})</span>
            </h2>
            <Card>
              <ul className="divide-line">
                {itens.map((i) => (
                  <li key={i.pagamentoId} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[220px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--text)]">{i.clienteNome}</p>
                          {badgeTipo(i.tipo)}
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                          {i.sistemaNome} · {i.descricao} ·{" "}
                          <span className="tnum font-semibold text-[var(--text)]">{brl(i.valor)}</span> · venc.{" "}
                          {dataBR(i.vencimento)}
                          {i.tipo === "atraso" && (
                            <span className="text-[var(--red)]"> · {-i.diasAteVencer} dia(s) de atraso</span>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {i.telefones.length === 0 ? (
                          <Link href="/admin/clientes" className="text-xs text-amber-300 hover:underline">
                            sem WhatsApp — cadastrar →
                          </Link>
                        ) : (
                          i.telefones.map((t) => (
                            <BotaoLembrete
                              key={t}
                              telefone={t}
                              texto={i.texto}
                              pagamentoId={i.pagamentoId}
                              tipo={i.tipo}
                              enviado={jaEnviado(i.pagamentoId, i.tipo, t)}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-cyan-300">ver mensagem</summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--muted)]">
                        {i.texto}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}

      {/* Próximos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Próximos 14 dias{" "}
          <span className="text-sm font-normal text-[var(--muted)]">(vão entrar na fila)</span>
        </h2>
        <Card>
          {proximos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhum vencimento nos próximos 14 dias.</p>
          ) : (
            <ul className="divide-line">
              {proximos.map((p, k) => (
                <li key={k} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">{p.clienteNome}</span> · {p.sistemaNome} ·{" "}
                    {p.descricao}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tnum font-semibold text-[var(--text)]">{brl(p.valor)}</span>
                    <span className="tnum text-xs text-[var(--muted)]">
                      {dataBR(p.vencimento)} · em {p.dias} dia{p.dias === 1 ? "" : "s"}
                      {p.dias > 3 ? ` · aviso em ${p.dias - 3} dia${p.dias - 3 === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
