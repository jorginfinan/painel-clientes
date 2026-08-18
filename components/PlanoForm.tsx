"use client";

import { useState } from "react";
import { gerarPlano } from "@/app/admin/actions";

const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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
  const [entrada, setEntrada] = useState(0);
  const [valorDev, setValorDev] = useState(0);

  const nn = Math.max(1, n || 1);
  const aParcelar =
    modo === "entrada" ? total - entrada : modo === "desenvolvimento" ? valorDev : total;
  const parcela = aParcelar / nn;
  const restante = total - valorDev;

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
      )}

      {modo === "desenvolvimento" && (
        <div>
          <label className="label">
            Valor pago durante o desenvolvimento (R$)
          </label>
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
            name="num_parcelas"
            type="number"
            min="1"
            value={n || ""}
            onChange={(e) => setN(Number(e.target.value) || 1)}
            className="field"
          />
        </div>
        <div>
          <label className="label">1º vencimento</label>
          <input
            name="data_inicio"
            type="date"
            defaultValue={hoje}
            className="field"
            required
          />
        </div>
      </div>

      {/* Preview ao vivo */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--muted)]">
        <p className="mb-1 font-semibold uppercase tracking-wide text-cyan-300">
          Resumo do plano
        </p>
        {modo === "entrada" && (
          <p>
            Entrada de{" "}
            <span className="font-semibold text-[var(--text)]">{brl(entrada)}</span> +{" "}
          </p>
        )}
        <p>
          {nn}× de{" "}
          <span className="font-semibold text-[var(--text)]">{brl(parcela)}</span>
          {modo === "entrada" && " (após a entrada)"}
          {modo === "desenvolvimento" && " durante o desenvolvimento"}
        </p>
        {modo === "desenvolvimento" && (
          <p>
            + restante de{" "}
            <span className="font-semibold text-amber-300">{brl(restante)}</span> em
            aberto na conclusão
          </p>
        )}
        <p className="mt-1 border-t border-white/10 pt-1">
          Total:{" "}
          <span className="font-semibold text-[var(--text)]">{brl(total)}</span>
        </p>
      </div>

      <button className="btn-dark w-full">Gerar plano de pagamento</button>
    </form>
  );
}
