"use client";

import { useMemo, useState } from "react";
import { renegociar } from "@/app/admin/actions";
import { ParcelasEditor } from "@/components/ParcelasEditor";

const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "na conclusão";
const cent = (v: number) => Math.round(v * 100) / 100;

type Aberta = { id: string; descricao: string; saldo: number; vencimento: string | null };

export function RenegociarForm({
  sistemaId,
  abertas,
  hoje,
}: {
  sistemaId: string;
  abertas: Aberta[];
  hoje: string;
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(abertas.map((a) => a.id)));
  const [tipoAjuste, setTipoAjuste] = useState<"nenhum" | "juros" | "desconto">("nenhum");
  const [ajusteValor, setAjusteValor] = useState(0);
  const [entrada, setEntrada] = useState(0);
  const [n, setN] = useState(3);
  const [inicio, setInicio] = useState(hoje);
  const [parcelasOk, setParcelasOk] = useState(true);

  const aberto = useMemo(
    () => cent(abertas.filter((a) => sel.has(a.id)).reduce((s, a) => s + a.saldo, 0)),
    [abertas, sel]
  );
  const ajuste = tipoAjuste === "juros" ? ajusteValor : tipoAjuste === "desconto" ? -ajusteValor : 0;
  const montante = cent(Math.max(0, aberto + ajuste));
  const aParcelar = cent(Math.max(0, montante - entrada));

  const invalido = sel.size === 0 || montante <= 0 || entrada > montante || !parcelasOk;

  const toggle = (id: string) =>
    setSel((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });

  return (
    <form action={renegociar} className="space-y-4">
      <input type="hidden" name="sistema_id" value={sistemaId} />
      <input type="hidden" name="ajuste" value={ajuste} />

      {/* 1) parcelas que entram no montante */}
      <div>
        <p className="label">Parcelas em aberto que entram no montante</p>
        <ul className="divide-line rounded-lg border border-white/10 bg-white/[0.02] px-3">
          {abertas.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
              <input
                type="checkbox"
                name="pagamento_ids"
                value={a.id}
                checked={sel.has(a.id)}
                onChange={() => toggle(a.id)}
                className="h-4 w-4 accent-cyan-400"
              />
              <span className="flex-1 text-[var(--text)]">
                {a.descricao}{" "}
                <span className="text-xs text-[var(--muted)]">· venc. {dataBR(a.vencimento)}</span>
              </span>
              <span className="tnum font-semibold text-[var(--text)]">{brl(a.saldo)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 2) ajuste do montante */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Ajuste no montante</label>
          <select
            value={tipoAjuste}
            onChange={(e) => setTipoAjuste(e.target.value as typeof tipoAjuste)}
            className="field"
          >
            <option value="nenhum">Sem ajuste</option>
            <option value="juros">+ Juros / acréscimo</option>
            <option value="desconto">− Desconto</option>
          </select>
        </div>
        {tipoAjuste !== "nenhum" && (
          <div>
            <label className="label">
              Valor do {tipoAjuste === "juros" ? "acréscimo" : "desconto"} (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ajusteValor || ""}
              onChange={(e) => setAjusteValor(Number(e.target.value) || 0)}
              className="field"
            />
          </div>
        )}
      </div>

      {/* 3) novo parcelamento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Entrada (R$, opcional)</label>
          <input
            name="entrada"
            type="number"
            step="0.01"
            min="0"
            value={entrada || ""}
            onChange={(e) => setEntrada(Number(e.target.value) || 0)}
            className="field"
          />
        </div>
        <div>
          <label className="label">Data da entrada</label>
          <input name="data_entrada" type="date" defaultValue={hoje} className="field" />
        </div>
        <div>
          <label className="label">Nº de parcelas</label>
          <input
            type="number"
            min="1"
            max="120"
            value={n || ""}
            onChange={(e) => setN(Number(e.target.value) || 1)}
            disabled={aParcelar <= 0}
            className="field disabled:opacity-40"
          />
        </div>
        <div>
          <label className="label">1º vencimento</label>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            disabled={aParcelar <= 0}
            className="field disabled:opacity-40"
          />
        </div>
      </div>

      <div>
        <label className="label">Observação (opcional)</label>
        <input name="observacao" placeholder="Ex.: acordo feito por WhatsApp em 19/10" className="field" />
      </div>

      {/* 4) simulação: parcelas geradas, editáveis */}
      <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Simulação das parcelas
        </p>
        <div className="mb-3 grid gap-x-6 gap-y-0.5 text-xs text-[var(--muted)] sm:grid-cols-2">
          <p>
            Saldo em aberto ({sel.size} parcela{sel.size === 1 ? "" : "s"}):{" "}
            <span className="tnum font-semibold text-[var(--text)]">{brl(aberto)}</span>
          </p>
          {ajuste !== 0 && (
            <p>
              {ajuste > 0 ? "+ Juros/acréscimo" : "− Desconto"}:{" "}
              <span className={`tnum font-semibold ${ajuste > 0 ? "text-amber-300" : "text-[var(--green)]"}`}>
                {brl(Math.abs(ajuste))}
              </span>
            </p>
          )}
          <p>
            Novo montante: <span className="tnum font-bold text-[var(--text)]">{brl(montante)}</span>
          </p>
          {entrada > 0 && (
            <p>
              A parcelar (montante − entrada):{" "}
              <span className="tnum font-semibold text-[var(--text)]">{brl(aParcelar)}</span>
            </p>
          )}
        </div>

        <ParcelasEditor
          total={aParcelar}
          n={n}
          inicio={inicio}
          rotulo="Reneg."
          onValidoChange={setParcelasOk}
          antes={
            entrada > 0 ? (
              <li className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 font-medium text-[var(--text)]">Entrada</span>
                <span className="flex-1 text-xs text-[var(--muted)]">data informada acima</span>
                <span className="tnum font-semibold text-[var(--text)]">{brl(entrada)}</span>
              </li>
            ) : null
          }
        />
        {aParcelar <= 0 && montante > 0 && entrada <= montante && (
          <p className="mt-2 text-xs text-[var(--muted)]">Sem parcelas — quitado na entrada.</p>
        )}
        {entrada > montante && (
          <p className="mt-1 text-xs text-[var(--red)]">A entrada é maior que o montante.</p>
        )}
      </div>

      <button disabled={invalido} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">
        Confirmar renegociação
      </button>
    </form>
  );
}
