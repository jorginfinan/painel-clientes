export type Role = "admin" | "cliente";

export type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
  role: Role;
  created_at: string;
};

// Sistema PRÓPRIO da Koryva (produto interno, não vendido a cliente).
export type SistemaProprio = {
  id: string;
  nome: string;
  descricao: string | null;
  status: "desenvolvimento" | "no_ar" | "pausado";
  progresso: number;
  custo_mensal: number;
  receita_mensal: number;
  url: string | null;
  repositorio: string | null;
  servidor: string | null;
  observacoes: string | null;
  created_at: string;
};

export type Sistema = {
  id: string;
  cliente_id: string | null;
  nome: string;
  descricao: string | null;
  progresso: number;
  valor_total: number;
  custo_mensal: number;
  status: "em_andamento" | "concluido" | "pausado";
  created_at: string;
};

export type Pagamento = {
  id: string;
  sistema_id: string;
  descricao: string;
  valor: number;
  valor_pago: number; // quanto já foi recebido desta parcela (permite baixa parcial)
  vencimento: string | null;
  pago: boolean;
  data_pagamento: string | null;
  tipo: "parcela" | "mensalidade" | "avulso" | "entrada" | "conclusao";
  // preenchido quando esta parcela foi encerrada por uma renegociação
  renegociacao_id?: string | null;
  // preenchido quando esta parcela NASCEU de uma renegociação
  origem_renegociacao_id?: string | null;
  created_at: string;
};

export type Renegociacao = {
  id: string;
  sistema_id: string;
  valor_aberto: number; // saldo das parcelas encerradas
  valor_novo: number; // montante renegociado (aberto + juros − desconto)
  entrada: number;
  num_parcelas: number;
  observacao: string | null;
  created_at: string;
};

export type Melhoria = {
  id: string;
  sistema_id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  created_at: string;
};

export type Tarefa = {
  id: string;
  sistema_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta";
  concluida: boolean;
  created_at: string;
};
