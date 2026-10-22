"use client";

import { useEffect, useState } from "react";

// Lista de parcelas gerada a partir de (total, nº, 1º vencimento), com valor e data
// editáveis. Ao editar o valor de uma, o que sobra é redistribuído entre as não editadas.
// Envia ao servidor os campos parc_valor[] e parc_venc[] (na ordem das parcelas).

const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cent = (v: number) => Math.round(v * 100) / 100;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (d: string) => (d ? `${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}` : "");

function addMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1 + meses, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// divide `total` em `k` partes iguais (a última absorve os centavos)
function dividir(total: number, k: number) {
  if (k <= 0) return [];
  const p = cent(total / k);
  return Array.from({ length: k }, (_, i) => (i === k - 1 ? cent(total - p * (k - 1)) : p));
}

export function ParcelasEditor({
  total,
  n,
  inicio,
  rotulo = "Parcela",
  antes,
  depois,
  onValidoChange,
}: {
  total: number; // valor a parcelar
  n: number; // nº de parcelas (0 = nenhuma)
  inicio: string; // 1º vencimento YYYY-MM-DD
  rotulo?: string; // "Parcela" -> "Parcela 1/4"
  antes?: React.ReactNode; // linhas fixas antes (ex.: entrada)
  depois?: React.ReactNode; // linhas fixas depois (ex.: restante na conclusão)
  onValidoChange?: (ok: boolean) => void;
}) {
  const alvo = cent(Math.max(0, total));
  const nn = alvo > 0 ? Math.min(120, Math.max(1, n || 1)) : 0;

  const [valores, setValores] = useState<number[]>(() => dividir(alvo, nn));
  const [vencs, setVencs] = useState<string[]>(() =>
    Array.from({ length: nn }, (_, i) => (inicio ? addMeses(inicio, i) : ""))
  );
  const [travadas, setTravadas] = useState<Set<number>>(new Set());

  // total ou nº mudou -> refaz a divisão igual
  useEffect(() => {
    setValores(dividir(alvo, nn));
    setTravadas(new Set());
  }, [alvo, nn]);

  // nº ou 1º vencimento mudou -> refaz os meses
  useEffect(() => {
    setVencs(Array.from({ length: nn }, (_, i) => (inicio ? addMeses(inicio, i) : "")));
  }, [nn, inicio]);

  const editarValor = (i: number, v: number) => {
    const trav = new Set(travadas).add(i);
    const novos = valores.slice();
    novos[i] = cent(Math.max(0, v));
    const livres = novos.map((_, k) => k).filter((k) => !trav.has(k));
    const fixo = cent([...trav].reduce((s, k) => s + (novos[k] ?? 0), 0));
    const partes = dividir(Math.max(0, cent(alvo - fixo)), livres.length);
    livres.forEach((k, j) => (novos[k] = partes[j]));
    setTravadas(trav);
    setValores(novos);
  };

  const soma = cent(valores.reduce((s, v) => s + v, 0));
  const diferenca = cent(alvo - soma);
  const temZerada = valores.some((v) => v <= 0);
  const semData = vencs.some((d) => !d);
  const ok =
    nn === 0 ||
    (valores.length === nn && vencs.length === nn && Math.abs(diferenca) <= 0.005 && !temZerada && !semData);

  useEffect(() => {
    onValidoChange?.(ok);
  }, [ok, onValidoChange]);

  return (
    <div>
      {valores.map((v, i) => (
        <input key={`v${i}`} type="hidden" name="parc_valor" value={v} />
      ))}
      {vencs.map((d, i) => (
        <input key={`d${i}`} type="hidden" name="parc_venc" value={d} />
      ))}

      {nn > 0 && travadas.size > 0 && (
        <div className="mb-1.5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setValores(dividir(alvo, nn));
              setTravadas(new Set());
            }}
            className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            ↺ Dividir igualmente
          </button>
        </div>
      )}

      <ul className="divide-line rounded-lg border border-white/10 bg-[#05060b]/40 px-3 text-sm">
        {antes}
        {valores.map((v, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
            <span className="w-24 shrink-0 font-medium text-[var(--text)]">
              {rotulo} {i + 1}/{nn}
            </span>
            <span className="w-16 shrink-0 text-xs text-cyan-300">{mesAno(vencs[i] ?? "")}</span>
            {/* wrappers com largura fixa: .field força width:100% */}
            <div className="w-40 shrink-0">
              <input
                type="date"
                value={vencs[i] ?? ""}
                onChange={(e) => setVencs((vs) => vs.map((x, k) => (k === i ? e.target.value : x)))}
                className="field py-1 text-xs"
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">R$</span>
              <div className="w-32 shrink-0">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v || ""}
                  onChange={(e) => editarValor(i, Number(e.target.value) || 0)}
                  className={`field py-1 text-right text-sm tnum ${travadas.has(i) ? "border-cyan-400/50" : ""}`}
                />
              </div>
              <span
                title={travadas.has(i) ? "Valor definido por você" : "Calculado automaticamente"}
                className="w-4 text-center text-xs"
              >
                {travadas.has(i) ? "✎" : ""}
              </span>
            </div>
          </li>
        ))}
        {depois}
        {nn === 0 && !antes && !depois && (
          <li className="py-2 text-xs text-[var(--muted)]">Nenhuma parcela a gerar.</li>
        )}
      </ul>

      {nn > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[var(--muted)]">
            Soma das parcelas: <span className="tnum font-semibold text-[var(--text)]">{brl(soma)}</span>
          </span>
          {Math.abs(diferenca) > 0.005 ? (
            <span className="font-semibold text-[var(--red)]">
              {diferenca > 0 ? `Faltam ${brl(diferenca)}` : `Passou ${brl(-diferenca)}`} para fechar {brl(alvo)}
            </span>
          ) : temZerada ? (
            <span className="font-semibold text-[var(--red)]">Há parcela com valor zero</span>
          ) : (
            <span className="font-semibold text-[var(--green)]">✓ Fecha com o valor</span>
          )}
        </div>
      )}
    </div>
  );
}
