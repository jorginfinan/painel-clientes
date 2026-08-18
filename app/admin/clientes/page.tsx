import { Card, Badge } from "@/components/ui";
import { criarCliente, adicionarTelefone, removerTelefone } from "../actions";
import { brl, dataBR } from "@/lib/format";
import {
  montarMensagemLembrete,
  linkWhatsApp,
  formatarTelefone,
} from "@/lib/lembrete";
import * as db from "@/lib/db";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;

  const cls = await db.listClientes();
  const sis = await db.listSistemas();
  const pags = await db.listPagamentos();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="mb-3 font-semibold text-[var(--text)]">Novo cliente</h2>
            {ok && (
              <p className="chip-green mb-3 rounded-lg px-3 py-2 text-sm">
                Cliente criado com sucesso.
              </p>
            )}
            {erro && (
              <p className="chip-red mb-3 rounded-lg px-3 py-2 text-sm">{erro}</p>
            )}
            <form action={criarCliente} className="space-y-3">
              <input name="nome" required placeholder="Nome do cliente" className="field" />
              <input
                name="email"
                type="email"
                required
                placeholder="E-mail de acesso"
                className="field"
              />
              <input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="Senha inicial (mín. 6)"
                className="field"
              />
              <button className="btn-primary w-full">Criar acesso do cliente</button>
              <p className="text-xs text-[var(--muted)]">
                O cliente entra em <code className="text-cyan-300">/login</code> com
                esse e-mail e senha. Os WhatsApps são cadastrados na lista ao lado.
              </p>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold text-[var(--text)]">
              Clientes ({cls.length})
            </h2>
            {cls.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nenhum cliente cadastrado.</p>
            ) : (
              <ul className="divide-line">
                {cls.map((c) => {
                  const seus = sis.filter((s) => s.cliente_id === c.id);
                  const idsSeus = new Set(seus.map((s) => s.id));
                  const pagsSeus = pags.filter((p) => idsSeus.has(p.sistema_id));
                  // (montarMensagemLembrete já ignora sistemas pausados)
                  const lembrete = montarMensagemLembrete(c.nome, seus, pagsSeus);
                  const tels = c.telefones ?? [];
                  return (
                    <li key={c.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[var(--text)]">
                            {c.nome ?? "(sem nome)"}
                          </p>
                          <p className="text-xs text-[var(--muted)]">{c.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs text-[var(--muted)]">
                            desde {dataBR(c.created_at.slice(0, 10))}
                          </span>
                          {lembrete.totalAberto > 0 && (
                            <span
                              className={`tnum text-xs font-semibold ${
                                lembrete.totalAtrasado > 0
                                  ? "text-[var(--red)]"
                                  : "text-amber-300"
                              }`}
                            >
                              em aberto: {brl(lembrete.totalAberto)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {seus.length === 0 ? (
                          <Badge tone="gray">sem sistema</Badge>
                        ) : (
                          seus.map((s) => (
                            <Badge key={s.id} tone="blue">
                              {s.nome}
                            </Badge>
                          ))
                        )}
                      </div>

                      {/* WhatsApps */}
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          WhatsApp(s) para lembrete
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {tels.length === 0 && (
                            <span className="text-xs text-[var(--muted)]">
                              nenhum número cadastrado
                            </span>
                          )}
                          {tels.map((t) => (
                            <span
                              key={t}
                              className="chip chip-gray gap-1.5 text-[0.7rem]"
                            >
                              {formatarTelefone(t)}
                              <form action={removerTelefone} className="inline">
                                <input type="hidden" name="usuario_id" value={c.id} />
                                <input type="hidden" name="telefone" value={t} />
                                <button
                                  title="Remover"
                                  className="text-[var(--muted)] hover:text-[var(--red)]"
                                >
                                  ✕
                                </button>
                              </form>
                            </span>
                          ))}
                          <form
                            action={adicionarTelefone}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="usuario_id" value={c.id} />
                            <input
                              name="telefone"
                              placeholder="(83) 99999-8888"
                              className="field w-40 py-1 text-xs"
                              required
                            />
                            <button className="btn-ghost py-1 text-xs">+ nº</button>
                          </form>
                        </div>

                        {/* Lembrete: 1 clique por número */}
                        {lembrete.totalAberto > 0 && tels.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                            <span className="text-xs text-[var(--muted)]">
                              Enviar lembrete de{" "}
                              <span className="font-semibold text-[var(--text)]">
                                {brl(lembrete.totalAberto)}
                              </span>{" "}
                              para:
                            </span>
                            {tels.map((t) => (
                              <a
                                key={t}
                                href={linkWhatsApp(t, lembrete.texto)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/20"
                              >
                                💬 {formatarTelefone(t)}
                              </a>
                            ))}
                          </div>
                        )}
                        {lembrete.totalAberto > 0 && tels.length === 0 && (
                          <p className="mt-2 text-xs text-amber-300">
                            Cadastre um WhatsApp acima pra habilitar o lembrete.
                          </p>
                        )}
                        {lembrete.totalAberto === 0 && (
                          <p className="mt-2 text-xs text-[var(--green)]">
                            Nada em aberto — sem lembrete pra enviar. ✅
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
