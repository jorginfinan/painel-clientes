import { brl, dataBR, hoje, saldoDe } from "@/lib/format";
import type { Sistema, Pagamento } from "@/lib/types";

// Monta a mensagem de lembrete de valor em aberto para um cliente.
export function montarMensagemLembrete(
  nomeCliente: string,
  sistemas: Sistema[],
  pagamentos: Pagamento[]
): { texto: string; totalAberto: number; totalAtrasado: number } {
  const hj = hoje();
  let totalAberto = 0;
  let totalAtrasado = 0;
  const linhas: string[] = [];

  for (const s of sistemas) {
    // Sistema PAUSADO: cobrança suspensa — não entra no lembrete.
    if (s.status === "pausado") continue;
    const abertos = pagamentos
      .filter((p) => p.sistema_id === s.id && saldoDe(p) > 0)
      .sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"));
    if (abertos.length === 0) continue;

    linhas.push(`\n*${s.nome}*`);
    for (const p of abertos) {
      const saldo = saldoDe(p);
      totalAberto += saldo;
      const atrasado = p.vencimento && p.vencimento < hj;
      if (atrasado) totalAtrasado += saldo;
      const venc = p.vencimento
        ? `venc. ${dataBR(p.vencimento)}${atrasado ? " ⚠️ atrasado" : ""}`
        : "na conclusão";
      linhas.push(`• ${p.descricao}: ${brl(saldo)} (${venc})`);
    }
  }

  const primeiroNome = nomeCliente.split(" ")[0];
  let texto = `Olá, ${primeiroNome}! 👋\n\nPassando pra lembrar dos valores em aberto:\n`;
  texto += linhas.join("\n");
  texto += `\n\n*Total em aberto: ${brl(totalAberto)}*`;
  if (totalAtrasado > 0) texto += `\n_(sendo ${brl(totalAtrasado)} em atraso)_`;
  texto += `\n\nQualquer dúvida é só chamar. Obrigado! 🙏\n— Koryva`;

  return { texto, totalAberto, totalAtrasado };
}

export function linkWhatsApp(telefone: string, texto: string): string {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
}

export function formatarTelefone(t: string): string {
  // 5583999998888 -> +55 (83) 99999-8888
  const m = t.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return "+" + t;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

// =============================================================================
// FILA DE LEMBRETES DO DIA
// Regras (definidas pelo Jorge):
//   aviso3 -> 3 dias antes do vencimento (a "semana")
//   dia    -> no dia do vencimento
//   atraso -> venceu e não foi paga (lembra todo dia até pagar)
// Foco: a parcela mais próxima de cada sistema (não a lista toda).
// Sistemas PAUSADOS ficam de fora (cobrança suspensa).
// =============================================================================

export type TipoLembrete = "aviso3" | "dia" | "atraso";

export type ItemFila = {
  tipo: TipoLembrete;
  clienteId: string;
  clienteNome: string;
  telefones: string[];
  sistemaNome: string;
  pagamentoId: string;
  descricao: string;
  valor: number; // saldo a pagar
  vencimento: string; // YYYY-MM-DD
  diasAteVencer: number; // negativo = atrasado
  texto: string; // mensagem pronta
};

const diffDias = (a: string, b: string) =>
  Math.round(
    (new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) /
      86400000
  );

export function textoAviso3(nome: string, sistema: string, desc: string, valor: number, venc: string) {
  const primeiro = nome.split(" ")[0];
  return (
    `Olá, ${primeiro}! 👋\n\n` +
    `Só passando pra lembrar que a *${desc}* do *${sistema}* vence dia *${dataBR(venc)}*.\n\n` +
    `Valor: *${brl(valor)}*\n\n` +
    `Qualquer dúvida é só chamar. 🙏\n— Koryva`
  );
}

export function textoDia(nome: string, sistema: string, desc: string, valor: number, venc: string) {
  const primeiro = nome.split(" ")[0];
  return (
    `Olá, ${primeiro}! 👋\n\n` +
    `Hoje (*${dataBR(venc)}*) é o vencimento da *${desc}* do *${sistema}*.\n\n` +
    `Valor: *${brl(valor)}*\n\n` +
    `Se já pagou, desconsidere. Obrigado! 🙏\n— Koryva`
  );
}

export function textoAtraso(nome: string, sistema: string, desc: string, valor: number, venc: string, dias: number) {
  const primeiro = nome.split(" ")[0];
  return (
    `Olá, ${primeiro}! 👋\n\n` +
    `A *${desc}* do *${sistema}* venceu em *${dataBR(venc)}* (há ${dias} dia${dias === 1 ? "" : "s"}) e ainda consta em aberto.\n\n` +
    `Valor: *${brl(valor)}*\n\n` +
    `Consegue regularizar? Se já pagou, me avisa que eu atualizo aqui. 🙏\n— Koryva`
  );
}

// Monta a fila de hoje. `clientes` precisa vir com telefones.
export function montarFilaHoje(
  clientes: { id: string; nome: string; telefones?: string[] }[],
  sistemas: Sistema[],
  pagamentos: Pagamento[]
): ItemFila[] {
  const hj = hoje();
  const fila: ItemFila[] = [];

  for (const c of clientes) {
    const seus = sistemas.filter((s) => s.cliente_id === c.id && s.status !== "pausado");
    for (const s of seus) {
      // parcela em aberto MAIS PRÓXIMA (com vencimento) deste sistema
      const proxima = pagamentos
        .filter((p) => p.sistema_id === s.id && saldoDe(p) > 0 && p.vencimento)
        .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!))[0];
      if (!proxima) continue;

      const dias = diffDias(proxima.vencimento!, hj);
      const saldo = saldoDe(proxima);
      let tipo: TipoLembrete | null = null;
      let texto = "";

      if (dias === 3) {
        tipo = "aviso3";
        texto = textoAviso3(c.nome, s.nome, proxima.descricao, saldo, proxima.vencimento!);
      } else if (dias === 0) {
        tipo = "dia";
        texto = textoDia(c.nome, s.nome, proxima.descricao, saldo, proxima.vencimento!);
      } else if (dias < 0) {
        tipo = "atraso";
        texto = textoAtraso(c.nome, s.nome, proxima.descricao, saldo, proxima.vencimento!, -dias);
      }
      if (!tipo) continue;

      fila.push({
        tipo,
        clienteId: c.id,
        clienteNome: c.nome,
        telefones: c.telefones ?? [],
        sistemaNome: s.nome,
        pagamentoId: proxima.id,
        descricao: proxima.descricao,
        valor: saldo,
        vencimento: proxima.vencimento!,
        diasAteVencer: dias,
        texto,
      });
    }
  }

  // atrasados primeiro, depois hoje, depois aviso
  const ordem: Record<TipoLembrete, number> = { atraso: 0, dia: 1, aviso3: 2 };
  return fila.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.vencimento.localeCompare(b.vencimento));
}

// Prévia dos próximos dias (pra você ver o que vai entrar na fila).
export function montarProximos(
  clientes: { id: string; nome: string; telefones?: string[] }[],
  sistemas: Sistema[],
  pagamentos: Pagamento[],
  dias = 14
) {
  const hj = hoje();
  const lim = new Date();
  lim.setDate(lim.getDate() + dias);
  const limStr = lim.toISOString().slice(0, 10);
  const out: { clienteNome: string; sistemaNome: string; descricao: string; valor: number; vencimento: string; dias: number }[] = [];
  for (const c of clientes) {
    for (const s of sistemas.filter((x) => x.cliente_id === c.id && x.status !== "pausado")) {
      const proxima = pagamentos
        .filter((p) => p.sistema_id === s.id && saldoDe(p) > 0 && p.vencimento && p.vencimento > hj && p.vencimento <= limStr)
        .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!))[0];
      if (!proxima) continue;
      out.push({ clienteNome: c.nome, sistemaNome: s.nome, descricao: proxima.descricao, valor: saldoDe(proxima), vencimento: proxima.vencimento!, dias: diffDias(proxima.vencimento!, hj) });
    }
  }
  return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}
