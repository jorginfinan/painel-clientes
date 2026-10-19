"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import * as db from "@/lib/db";

async function requireAdmin() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  if (u.role !== "admin") redirect("/cliente");
  return u;
}

const num = (v: FormDataEntryValue | null) => Number(v ?? 0) || 0;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const nul = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// Melhorias/tarefas são compartilhadas entre sistemas de cliente e próprios.
// `origem` decide qual página revalidar.
const baseDe = (fd: FormData) =>
  str(fd.get("origem")) === "proprio" ? "proprios" : "sistemas";

// ---------- Clientes (usuários com login) ----------

export async function criarCliente(formData: FormData) {
  await requireAdmin();
  const nome = str(formData.get("nome"));
  const email = str(formData.get("email"));
  const senha = str(formData.get("password"));

  if (senha.length < 6) {
    redirect(
      "/admin/clientes?erro=" +
        encodeURIComponent("A senha precisa ter ao menos 6 caracteres.")
    );
  }

  const res = await db.criarUsuario({ nome, email, senha, role: "cliente" });
  if (!res.ok) {
    redirect("/admin/clientes?erro=" + encodeURIComponent(res.erro));
  }
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes?ok=1");
}

export async function adicionarTelefone(formData: FormData) {
  await requireAdmin();
  await db.adicionarTelefone(str(formData.get("usuario_id")), str(formData.get("telefone")));
  revalidatePath("/admin/clientes");
}

export async function removerTelefone(formData: FormData) {
  await requireAdmin();
  await db.removerTelefone(str(formData.get("usuario_id")), str(formData.get("telefone")));
  revalidatePath("/admin/clientes");
}

// ---------- Lembretes (fila do dia) ----------

export async function marcarLembreteEnviado(formData: FormData) {
  await requireAdmin();
  await db.registrarLembrete({
    pagamento_id: str(formData.get("pagamento_id")),
    tipo: str(formData.get("tipo")) as never,
    telefone: str(formData.get("telefone")),
  });
  revalidatePath("/admin/lembretes");
}

export async function desfazerLembrete(formData: FormData) {
  await requireAdmin();
  await db.desfazerLembrete(str(formData.get("id")));
  revalidatePath("/admin/lembretes");
}

// ---------- Sistemas ----------

export async function criarSistema(formData: FormData) {
  await requireAdmin();
  await db.criarSistema({
    nome: str(formData.get("nome")),
    cliente_id: nul(formData.get("cliente_id")),
    descricao: nul(formData.get("descricao")),
    valor_total: num(formData.get("valor_total")),
    custo_mensal: num(formData.get("custo_mensal")),
    progresso: num(formData.get("progresso")),
    status: (str(formData.get("status")) || "em_andamento") as never,
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function atualizarSistema(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  await db.atualizarSistema(id, {
    nome: str(formData.get("nome")),
    cliente_id: nul(formData.get("cliente_id")),
    descricao: nul(formData.get("descricao")),
    valor_total: num(formData.get("valor_total")),
    custo_mensal: num(formData.get("custo_mensal")),
    progresso: num(formData.get("progresso")),
    status: str(formData.get("status")) as never,
  });
  revalidatePath(`/admin/sistemas/${id}`);
  revalidatePath("/admin");
}

export async function excluirSistema(formData: FormData) {
  await requireAdmin();
  await db.excluirSistema(str(formData.get("id")));
  revalidatePath("/admin");
  redirect("/admin");
}

// ---------- Sistemas próprios (Koryva) ----------

export async function criarProprio(formData: FormData) {
  await requireAdmin();
  await db.criarProprio({
    nome: str(formData.get("nome")),
    descricao: nul(formData.get("descricao")),
    status: (str(formData.get("status")) || "desenvolvimento") as never,
    progresso: num(formData.get("progresso")),
    custo_mensal: num(formData.get("custo_mensal")),
    receita_mensal: num(formData.get("receita_mensal")),
    url: nul(formData.get("url")),
    repositorio: nul(formData.get("repositorio")),
    servidor: nul(formData.get("servidor")),
    observacoes: nul(formData.get("observacoes")),
  });
  revalidatePath("/admin/proprios");
  redirect("/admin/proprios");
}

export async function atualizarProprio(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  await db.atualizarProprio(id, {
    nome: str(formData.get("nome")),
    descricao: nul(formData.get("descricao")),
    status: str(formData.get("status")) as never,
    progresso: num(formData.get("progresso")),
    custo_mensal: num(formData.get("custo_mensal")),
    receita_mensal: num(formData.get("receita_mensal")),
    url: nul(formData.get("url")),
    repositorio: nul(formData.get("repositorio")),
    servidor: nul(formData.get("servidor")),
    observacoes: nul(formData.get("observacoes")),
  });
  revalidatePath(`/admin/proprios/${id}`);
  revalidatePath("/admin/proprios");
}

export async function excluirProprio(formData: FormData) {
  await requireAdmin();
  await db.excluirProprio(str(formData.get("id")));
  revalidatePath("/admin/proprios");
  redirect("/admin/proprios");
}

// ---------- Pagamentos ----------

const cent = (v: number) => Math.round(v * 100) / 100;

type LinhaPag = {
  sistema_id: string;
  descricao: string;
  valor: number;
  vencimento: string | null;
  pago: boolean;
  data_pagamento: null;
  tipo: "parcela" | "entrada" | "conclusao";
};

// Gera o plano de pagamento conforme o modo escolhido:
//   somente        -> total ÷ n parcelas
//   entrada        -> entrada agora + (total - entrada) ÷ n parcelas
//   desenvolvimento-> n parcelas no desenvolvimento + restante em aberto na conclusão
export async function gerarPlano(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  const modo = str(formData.get("modo")) || "somente";
  const total = num(formData.get("valor_total"));
  const n = Math.max(1, num(formData.get("num_parcelas")));
  const inicio = str(formData.get("data_inicio")); // YYYY-MM-DD, 1º venc. das parcelas
  const entrada = num(formData.get("entrada"));
  const valorDev = num(formData.get("valor_dev"));

  const [ano, mes, dia] = inicio.split("-").map(Number);
  const mkVenc = (i: number) => {
    const d = new Date(ano, mes - 1 + i, dia);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const linhas: LinhaPag[] = [];
  const base = { sistema_id: sistemaId, pago: false, data_pagamento: null as null };

  // valor a ser dividido em n parcelas de "parcela" e rótulo do restante
  let aParcelar = total;

  if (modo === "entrada") {
    linhas.push({
      ...base,
      descricao: "Entrada",
      valor: cent(entrada),
      vencimento: db.hojeStr(),
      tipo: "entrada",
    });
    aParcelar = total - entrada;
  } else if (modo === "desenvolvimento") {
    aParcelar = valorDev;
  }

  const parcela = cent(aParcelar / n);
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? cent(aParcelar - parcela * (n - 1)) : parcela;
    linhas.push({
      ...base,
      descricao: `Parcela ${i + 1}/${n}`,
      valor,
      vencimento: mkVenc(i),
      tipo: "parcela",
    });
  }

  if (modo === "desenvolvimento") {
    const restante = cent(total - valorDev);
    if (restante > 0) {
      linhas.push({
        ...base,
        descricao: "Restante na conclusão",
        valor: restante,
        vencimento: null, // em aberto — quita na entrega
        tipo: "conclusao",
      });
    }
  }

  // registra o valor do sistema junto
  await db.atualizarSistema(sistemaId, { valor_total: total });
  await db.criarPagamentos(linhas);
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

export async function adicionarPagamento(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  await db.criarPagamentos([
    {
      sistema_id: sistemaId,
      descricao: str(formData.get("descricao")),
      valor: num(formData.get("valor")),
      vencimento: nul(formData.get("vencimento")),
      pago: false,
      data_pagamento: null,
      tipo: (str(formData.get("tipo")) || "avulso") as never,
    },
  ]);
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

// Registra recebimento parcial (ou total) de uma parcela.
export async function registrarRecebimento(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  const valor = num(formData.get("valor"));
  const data = nul(formData.get("data_pagamento")) ?? undefined;
  if (valor > 0) await db.registrarRecebimento(str(formData.get("id")), valor, data);
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

// Quita a parcela inteira (baixa total).
export async function quitarPagamento(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  const data = nul(formData.get("data_pagamento")) ?? undefined;
  await db.quitarPagamento(str(formData.get("id")), data);
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

// Estorna (zera) os recebimentos da parcela.
export async function estornarPagamento(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  await db.estornarPagamento(str(formData.get("id")));
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

export async function excluirPagamento(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  await db.excluirPagamento(str(formData.get("id")));
  revalidatePath(`/admin/sistemas/${sistemaId}`);
}

// ---------- Renegociação ----------

// O saldo em aberto das parcelas escolhidas vira um montante (± juros/desconto)
// que é parcelado de novo. As parcelas antigas ficam no histórico como "Renegociada".
export async function renegociar(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  const voltar = (erro: string) =>
    redirect(`/admin/sistemas/${sistemaId}?erro=${encodeURIComponent(erro)}`);

  const ids = formData.getAll("pagamento_ids").map((v) => String(v));
  if (ids.length === 0) voltar("Selecione ao menos uma parcela para renegociar.");

  // recalcula o saldo no servidor (não confia no valor vindo da tela)
  const pags = (await db.listPagamentosBySistema(sistemaId)).filter(
    (p) => ids.includes(p.id) && !p.renegociacao_id
  );
  const saldo = (p: { valor: number; valor_pago: number }) =>
    Math.max(0, Number(p.valor) - Number(p.valor_pago ?? 0));
  const elegiveis = pags.filter((p) => saldo(p) > 0.0001);
  const valorAberto = cent(elegiveis.reduce((a, p) => a + saldo(p), 0));
  if (elegiveis.length === 0 || valorAberto <= 0) voltar("As parcelas escolhidas não têm saldo em aberto.");

  const ajuste = num(formData.get("ajuste")); // + juros / − desconto
  const valorNovo = cent(valorAberto + ajuste);
  const entrada = cent(num(formData.get("entrada")));
  const n = Math.floor(num(formData.get("num_parcelas")));
  const inicio = str(formData.get("data_inicio"));
  const dataEntrada = str(formData.get("data_entrada")) || db.hojeStr();
  const observacao = nul(formData.get("observacao"));

  if (valorNovo <= 0) voltar("O montante renegociado precisa ser maior que zero.");
  if (entrada < 0 || entrada > valorNovo) voltar("A entrada não pode ser maior que o montante.");
  const aParcelar = cent(valorNovo - entrada);
  if (aParcelar > 0 && (n < 1 || !inicio)) voltar("Informe o nº de parcelas e o 1º vencimento.");

  const base = { sistema_id: sistemaId, pago: false, data_pagamento: null };
  const novas: Parameters<typeof db.criarRenegociacao>[0]["novas"] = [];
  if (entrada > 0) {
    novas.push({ ...base, descricao: "Reneg. entrada", valor: entrada, vencimento: dataEntrada, tipo: "entrada" });
  }
  if (aParcelar > 0) {
    const [ano, mes, dia] = inicio.split("-").map(Number);
    const parcela = cent(aParcelar / n);
    for (let i = 0; i < n; i++) {
      const d = new Date(ano, mes - 1 + i, dia);
      const venc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      novas.push({
        ...base,
        descricao: `Reneg. ${i + 1}/${n}`,
        valor: i === n - 1 ? cent(aParcelar - parcela * (n - 1)) : parcela,
        vencimento: venc,
        tipo: "parcela",
      });
    }
  }

  try {
    await db.criarRenegociacao({
      sistema_id: sistemaId,
      pagamento_ids: elegiveis.map((p) => p.id),
      valor_aberto: valorAberto,
      valor_novo: valorNovo,
      entrada,
      num_parcelas: aParcelar > 0 ? n : 0,
      observacao,
      novas,
    });
  } catch (e) {
    voltar("Não foi possível renegociar: " + (e instanceof Error ? e.message : "erro"));
  }
  revalidatePath(`/admin/sistemas/${sistemaId}`);
  redirect(`/admin/sistemas/${sistemaId}?ok=reneg`);
}

export async function desfazerRenegociacao(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  const res = await db.desfazerRenegociacao(str(formData.get("id")));
  revalidatePath(`/admin/sistemas/${sistemaId}`);
  if (!res.ok) redirect(`/admin/sistemas/${sistemaId}?erro=${encodeURIComponent(res.erro)}`);
  redirect(`/admin/sistemas/${sistemaId}?ok=desfeita`);
}

// ---------- Melhorias ----------

export async function adicionarMelhoria(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  await db.criarMelhoria({
    sistema_id: sistemaId,
    titulo: str(formData.get("titulo")),
    descricao: nul(formData.get("descricao")),
    data: str(formData.get("data")) || db.hojeStr(),
  });
  revalidatePath(`/admin/${baseDe(formData)}/${sistemaId}`);
}

export async function excluirMelhoria(formData: FormData) {
  await requireAdmin();
  const sistemaId = str(formData.get("sistema_id"));
  await db.excluirMelhoria(str(formData.get("id")));
  revalidatePath(`/admin/${baseDe(formData)}/${sistemaId}`);
}

// ---------- Tarefas ----------

export async function adicionarTarefa(formData: FormData) {
  await requireAdmin();
  const sistemaId = nul(formData.get("sistema_id"));
  await db.criarTarefa({
    sistema_id: sistemaId,
    titulo: str(formData.get("titulo")),
    descricao: nul(formData.get("descricao")),
    prioridade: (str(formData.get("prioridade")) || "media") as never,
  });
  revalidatePath("/admin");
  if (sistemaId) revalidatePath(`/admin/${baseDe(formData)}/${sistemaId}`);
}

export async function alternarTarefa(formData: FormData) {
  await requireAdmin();
  await db.alternarTarefa(str(formData.get("id")));
  revalidatePath("/admin");
  const sistemaId = nul(formData.get("sistema_id"));
  if (sistemaId) revalidatePath(`/admin/${baseDe(formData)}/${sistemaId}`);
}

export async function excluirTarefa(formData: FormData) {
  await requireAdmin();
  await db.excluirTarefa(str(formData.get("id")));
  revalidatePath("/admin");
  const sistemaId = nul(formData.get("sistema_id"));
  if (sistemaId) revalidatePath(`/admin/${baseDe(formData)}/${sistemaId}`);
}
