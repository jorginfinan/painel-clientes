"use client";

import { useEffect, useMemo, useState } from "react";
import { renegociar } from "@/app/admin/actions";

const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "na conclusão";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (d: string) => (d ? `${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}` : "");
const cent = (v: number) => Math.round(v * 100) / 100;

// soma `meses` a uma data YYYY-MM-DD mantendo o dia
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

  const aberto = useMemo(
    () => cent(abertas.filter((a) => sel.has(a.id)).reduce((s, a) => s + a.saldo, 0)),
    [abertas, sel]
  );
  const ajuste = tipoAjuste === "juros" ? ajusteValor : tipoAjuste === "desconto" ? -ajusteValor : 0;
  const montante = cent(Math.max(0, aberto + ajuste));
  const aParcelar = cent(Math.max(0, montante - entrada));
  const nn = aParcelar > 0 ? Math.min(120, Math.max(1, n || 1)) : 0;

  // parcelas da simulação (editáveis)
  const [valores, setValores] = useState<number[]>(() => dividir(aParcelar, nn));
  const [vencs, setVencs] = useState<string[]>(() =>
    Array.from({ length: nn }, (_, i) => addMeses(hoje, i))
  );
  const [travadas, setTravadas] = useState<Set<number>>(new Set()); // editadas à mão

  // montante ou nº de parcelas mudou -> refaz a divisão igual
  useEffect(() => {
    setValores(dividir(aParcelar, nn));
    setTravadas(new Set());
  }, [aParcelar, nn]);

  // nº de parcelas ou 1º vencimento mudou -> refaz os meses
  useEffect(() => {
    setVencs(Array.from({ length: nn }, (_, i) => (inicio ? addMeses(inicio, i) : "")));
  }, [nn, inicio]);

  // ao editar uma parcela, o que sobra é redistribuído entre as não editadas
  const editarValor = (i: number, v: number) => {
    const trav = new Set(travadas).add(i);
    const novos = valores.slice();
    novos[i] = cent(Math.max(0, v));
    const livres = novos.map((_, k) => k).filter((k) => !trav.has(k));
    const fixo = cent([...trav].reduce((s, k) => s + (novos[k] ?? 0), 0));
    const sobra = cent(aParcelar - fixo);
    const partes = dividir(Math.max(0, sobra), livres.length);
    livres.forEach((k, j) => (novos[k] = partes[j]));
    setTravadas(trav);
    setValores(novos);
  };

  const editarVenc = (i: number, d: string) =>
    setVencs((vs) => vs.map((x, k) => (k === i ? d : x)));

  const dividirIgual = () => {
    setValores(dividir(aParcelar, nn));
    setTravadas(new Set());
  };

  const soma = cent(valores.reduce((s, v) => s + v, 0));
  const diferenca = cent(aParcelar - soma);
  const temZerada = valores.some((v) => v <= 0);
  const semData = vencs.some((d) => !d);
  const invalido =
    sel.size === 0 ||
    montante <= 0 ||
    entrada > montante ||
    (nn > 0 && (Math.abs(diferenca) > 0.005 || temZerada || semData));

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
      {/* parcelas finais (já editadas) vão para o servidor */}
      {valores.map((v, i) => (
        <input key={`v${i}`} type="hidden" name="parc_valor" value={v} />
      ))}
      {vencs.map((d, i) => (
        <input key={`d${i}`} type="hidden" name="parc_venc" value={d} />
      ))}

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Simulação das parcelas
          </p>
          {nn > 0 && travadas.size > 0 && (
            <button
              type="button"
              onClick={dividirIgual}
              className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              ↺ Dividir igualmente
            </button>
          )}
        </div>

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

        <ul className="divide-line rounded-lg border border-white/10 bg-[#05060b]/40 px-3 text-sm">
          {entrada > 0 && (
            <li className="flex items-center gap-3 py-2">
              <span className="w-24 shrink-0 font-medium text-[var(--text)]">Entrada</span>
              <span className="flex-1 text-xs text-[var(--muted)]">data informada acima</span>
              <span className="tnum font-semibold text-[var(--text)]">{brl(entrada)}</span>
            </li>
          )}
          {valores.map((v, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
              <span className="w-24 shrink-0 font-medium text-[var(--text)]">
                Reneg. {i + 1}/{nn}
              </span>
              <span className="w-16 shrink-0 text-xs text-cyan-300">{mesAno(vencs[i])}</span>
              {/* wrappers com largura fixa: .field força width:100% */}
              <div className="w-40 shrink-0">
                <input
                  type="date"
                  value={vencs[i] ?? ""}
                  onChange={(e) => editarVenc(i, e.target.value)}
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
                    className={`field py-1 text-right text-sm tnum ${
                      travadas.has(i) ? "border-cyan-400/50" : ""
                    }`}
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
          {nn === 0 && (
            <li className="py-2 text-xs text-[var(--muted)]">Sem parcelas — quitado na entrada.</li>
          )}
        </ul>

        {nn > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--muted)]">
              Soma das parcelas: <span className="tnum font-semibold text-[var(--text)]">{brl(soma)}</span>
            </span>
            {Math.abs(diferenca) > 0.005 ? (
              <span className="font-semibold text-[var(--red)]">
                {diferenca > 0 ? `Faltam ${brl(diferenca)}` : `Passou ${brl(-diferenca)}`} para fechar{" "}
                {brl(aParcelar)}
              </span>
            ) : temZerada ? (
              <span className="font-semibold text-[var(--red)]">Há parcela com valor zero</span>
            ) : (
              <span className="font-semibold text-[var(--green)]">✓ Fecha com o montante</span>
            )}
          </div>
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
