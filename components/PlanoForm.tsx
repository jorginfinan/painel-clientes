"use client";

import { useState } from "react";
import { gerarPlano } from "@/app/admin/actions";
import { ParcelasEditor } from "@/components/ParcelasEditor";

const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const cent = (v: number) => Math.round(v * 100) / 100;

type Modo = "somente" | "entrada" | "desenvolvimento";

export function PlanoForm({
  sistemaId,
  valorTotalInicial,
  hoje,
}: {
  sistemaId: string;
  valorTotalInicial: number;
  hoje: string;
}) {
  const [modo, setModo] = useState<Modo>("somente");
  const [total, setTotal] = useState(valorTotalInicial || 0);
  const [n, setN] = useState(3);
  const [inicio, setInicio] = useState(hoje);
  const [entrada, setEntrada] = useState(0);
  const [valorDev, setValorDev] = useState(0);
  const [parcelasOk, setParcelasOk] = useState(true);

  const aParcelar = cent(
    Math.max(0, modo === "entrada" ? total - entrada : modo === "desenvolvimento" ? valorDev : total)
  );
  const restante = cent(total - valorDev);

  const erro =
    total <= 0
      ? "Informe o valor total do sistema."
      : modo === "entrada" && entrada > total
        ? "A entrada é maior que o valor total."
        : modo === "desenvolvimento" && valorDev > total
          ? "O valor do desenvolvimento é maior que o total."
          : null;
  const invalido = !!erro || !parcelasOk || (modo !== "entrada" && aParcelar <= 0);

  return (
    <form action={gerarPlano} className="space-y-3">
      <input type="hidden" name="sistema_id" value={sistemaId} />
      <input type="hidden" name="modo" value={modo} />

      <div>
        <label className="label">Valor total do sistema (R$)</label>
        <input
          name="valor_total"
          type="number"
          step="0.01"
          min="0"
          value={total || ""}
          onChange={(e) => setTotal(Number(e.target.value) || 0)}
          placeholder="Ex.: 6000"
          className="field"
          required
        />
      </div>

      <div>
        <label className="label">Formato de pagamento</label>
        <div className="grid gap-2">
          {(
            [
              ["somente", "Somente parcelas"],
              ["entrada", "Entrada + parcelas"],
              ["desenvolvimento", "Parcelas no desenvolvimento + restante na conclusão"],
            ] as [Modo, string][]
          ).map(([val, txt]) => (
            <button
              type="button"
              key={val}
              onClick={() => setModo(val)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                modo === val
                  ? "border-cyan-400/60 bg-cyan-400/10 text-[var(--text)]"
                  : "border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/20"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {modo === "entrada" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Entrada (R$)</label>
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
        </div>
      )}

      {modo === "desenvolvimento" && (
        <div>
          <label className="label">Valor pago durante o desenvolvimento (R$)</label>
          <input
            name="valor_dev"
            type="number"
            step="0.01"
            min="0"
            value={valorDev || ""}
            onChange={(e) => setValorDev(Number(e.target.value) || 0)}
            className="field"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
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

      {/* Simulação: parcelas geradas, editáveis */}
      <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Simulação das parcelas</p>
          <p className="text-xs text-[var(--muted)]">
            Total: <span className="tnum font-semibold text-[var(--text)]">{brl(total)}</span>
          </p>
        </div>
        <ParcelasEditor
          total={aParcelar}
          n={n}
          inicio={inicio}
          onValidoChange={setParcelasOk}
          antes={
            modo === "entrada" && entrada > 0 ? (
              <li className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 font-medium text-[var(--text)]">Entrada</span>
                <span className="flex-1 text-xs text-[var(--muted)]">data informada acima</span>
                <span className="tnum font-semibold text-[var(--text)]">{brl(entrada)}</span>
              </li>
            ) : null
          }
          depois={
            modo === "desenvolvimento" && restante > 0 ? (
              <li className="flex items-center gap-3 py-2">
                <span className="shrink-0 font-medium text-[var(--text)]">Restante na conclusão</span>
                <span className="flex-1 text-xs text-[var(--muted)]">em aberto até a entrega</span>
                <span className="tnum font-semibold text-amber-300">{brl(restante)}</span>
              </li>
            ) : null
          }
        />
        {erro && <p className="mt-2 text-xs text-[var(--red)]">{erro}</p>}
      </div>

      <button
        disabled={invalido}
        className="btn-dark w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        Gerar plano de pagamento
      </button>
    </form>
  );
}
