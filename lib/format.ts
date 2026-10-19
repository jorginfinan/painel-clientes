export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (d: string | null | undefined) => {
  if (!d) return "—";
  // d vem como "YYYY-MM-DD"; evita fuso adicionando T12:00.
  const dt = new Date(`${d}T12:00:00`);
  return dt.toLocaleDateString("pt-BR");
};

export const hoje = () => new Date().toISOString().slice(0, 10);

type PagLike = {
  valor: number;
  valor_pago?: number;
  pago: boolean;
  vencimento: string | null;
  // true quando o sistema dono está PAUSADO: a cobrança fica suspensa.
  suspenso?: boolean;
  // parcela encerrada por renegociação: o saldo dela migrou p/ parcelas novas.
  renegociacao_id?: string | null;
};

// Quanto já foi recebido de uma parcela (com fallback pra dados antigos).
export const recebidoDe = (p: PagLike) =>
  Number(p.valor_pago ?? (p.pago ? p.valor : 0));

// Quanto ainda falta receber de uma parcela (0 se foi renegociada).
export const saldoDe = (p: PagLike) =>
  p.renegociacao_id ? 0 : Math.max(0, Number(p.valor) - recebidoDe(p));

// Estado: renegociado | pago | parcial | suspenso | atrasado | aberto | conclusao.
export const estadoPag = (p: PagLike) => {
  if (p.renegociacao_id) return "renegociado";
  const saldo = saldoDe(p);
  if (saldo <= 0.0001) return "pago";
  if (p.suspenso) return "suspenso";
  if (recebidoDe(p) > 0.0001) return "parcial";
  if (!p.vencimento) return "conclusao";
  if (p.vencimento < hoje()) return "atrasado";
  return "aberto";
};

// Marca como suspensos os pagamentos cujo sistema está pausado.
export function aplicarSuspensao<T extends { sistema_id: string }>(
  pagamentos: T[],
  sistemas: { id: string; status: string }[]
): (T & { suspenso: boolean })[] {
  const pausados = new Set(
    sistemas.filter((s) => s.status === "pausado").map((s) => s.id)
  );
  return pagamentos.map((p) => ({ ...p, suspenso: pausados.has(p.sistema_id) }));
}

// Soma de recebido / restante a partir da lista (considera baixa parcial).
// Parcelas SUSPENSAS (sistema pausado) não contam em restante/atrasado —
// ficam em `suspenso` separado. O que já foi pago sempre conta.
export function resumoPagamentos(pagamentos: PagLike[]) {
  const hojeStr = hoje();
  let pago = 0;
  let restante = 0;
  let atrasado = 0;
  let suspenso = 0;
  for (const p of pagamentos) {
    const receb = recebidoDe(p);
    const saldo = saldoDe(p);
    pago += receb;
    if (p.suspenso) {
      suspenso += saldo;
      continue;
    }
    restante += saldo;
    if (saldo > 0 && p.vencimento && p.vencimento < hojeStr) atrasado += saldo;
  }
  return { pago, restante, atrasado, suspenso, total: pago + restante + suspenso };
}
