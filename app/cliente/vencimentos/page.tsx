import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Card, Stat, Badge } from "@/components/ui";
import { Voltar } from "@/components/Voltar";
import { brl, dataBR, hoje, saldoDe, recebidoDe } from "@/lib/format";
import { carregarResumoCliente, type PagComSistema } from "@/lib/resumo-cliente";

function Lista({
  titulo,
  itens,
  tone,
  vazio,
}: {
  titulo: string;
  itens: PagComSistema[];
  tone: "red" | "yellow" | "blue" | "gray";
  vazio: string;
}) {
  const total = itens.reduce((a, p) => a + saldoDe(p), 0);
  const cor =
    tone === "red" ? "text-[var(--red)]" : tone === "yellow" ? "text-amber-300" : "text-cyan-300";
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${cor}`}>{titulo}</h2>
        {itens.length > 0 && (
          <span className="tnum text-sm font-semibold text-[var(--text)]">{brl(total)}</span>
        )}
      </div>
      <Card>
        {itens.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{vazio}</p>
        ) : (
          <ul className="divide-line">
            {itens.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-[var(--text)]">{p.descricao}</p>
                  <p className="tnum text-xs text-[var(--muted)]">
                    {p.sistema_nome} ·{" "}
                    {p.vencimento ? `vence ${dataBR(p.vencimento)}` : "na conclusão do sistema"}
                    {recebidoDe(p) > 0 ? ` · já pago ${brl(recebidoDe(p))}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum font-semibold text-[var(--text)]">{brl(saldoDe(p))}</span>
                  <Badge tone={tone === "gray" ? "gray" : tone}>
                    {tone === "red"
                      ? "Atrasado"
                      : tone === "yellow"
                        ? "Em breve"
                        : tone === "blue"
                          ? "A vencer"
                          : p.suspenso
                            ? "⏸ Suspenso"
                            : "Na conclusão"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

export default async function VencimentosPage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  const r = await carregarResumoCliente(u.id);

  const hj = hoje();
  const em30 = new Date();
  em30.setDate(em30.getDate() + 30);
  const em30Str = em30.toISOString().slice(0, 10);

  const depois = r.emAberto.filter((p) => p.vencimento && p.vencimento > em30Str);
  const naConclusao = r.emAberto.filter((p) => !p.vencimento);
  const totalAberto = r.emAberto.reduce((a, p) => a + saldoDe(p), 0);
  const totalAtrasado = r.atrasados.reduce((a, p) => a + saldoDe(p), 0);
  const total30 = r.proximos30.reduce((a, p) => a + saldoDe(p), 0);

  return (
    <>
      <Voltar />
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Vencimentos</h1>
        <p className="text-sm text-[var(--muted)]">
          Tudo que ainda está em aberto, organizado por prazo. Hoje é {dataBR(hj)}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Em aberto" value={brl(totalAberto)} />
        <Stat
          label="Atrasado"
          value={brl(totalAtrasado)}
          tone={totalAtrasado > 0 ? "red" : "default"}
        />
        <Stat label="Próximos 30 dias" value={brl(total30)} tone="blue" />
        <Stat
          label="Próximo vencimento"
          value={r.proximo ? dataBR(r.proximo.vencimento) : "—"}
          hint={r.proximo ? brl(saldoDe(r.proximo)) : undefined}
        />
      </div>

      <Lista titulo="Atrasados" itens={r.atrasados} tone="red" vazio="Nada em atraso. 👏" />
      <Lista titulo="Próximos 30 dias" itens={r.proximos30} tone="yellow" vazio="Nada vencendo nos próximos 30 dias." />
      <Lista titulo="Depois de 30 dias" itens={depois} tone="blue" vazio="Nenhum vencimento mais à frente." />
      {naConclusao.length > 0 && (
        <Lista titulo="Na conclusão do sistema" itens={naConclusao} tone="gray" vazio="" />
      )}
      {r.suspensos.length > 0 && (
        <>
          <div className="chip-amber rounded-xl px-4 py-3 text-sm">
            ⏸ Sistema(s) pausado(s): as parcelas abaixo estão com a cobrança{" "}
            <strong>suspensa</strong> até o trabalho ser retomado. Não geram atraso.
          </div>
          <Lista titulo="Suspensos (sistema pausado)" itens={r.suspensos} tone="gray" vazio="" />
        </>
      )}
    </>
  );
}
