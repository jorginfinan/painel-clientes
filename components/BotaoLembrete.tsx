"use client";

import { useRef } from "react";
import { marcarLembreteEnviado } from "@/app/admin/actions";
import { linkWhatsApp, formatarTelefone } from "@/lib/lembrete";

// Abre o WhatsApp com a mensagem pronta E registra o envio no mesmo clique.
export function BotaoLembrete({
  telefone,
  texto,
  pagamentoId,
  tipo,
  enviado,
}: {
  telefone: string;
  texto: string;
  pagamentoId: string;
  tipo: "aviso3" | "dia" | "atraso";
  enviado: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={marcarLembreteEnviado} className="inline">
      <input type="hidden" name="pagamento_id" value={pagamentoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="telefone" value={telefone} />
      <button
        type="button"
        onClick={() => {
          window.open(linkWhatsApp(telefone, texto), "_blank", "noopener,noreferrer");
          formRef.current?.requestSubmit();
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
          enviado
            ? "border-white/10 bg-white/[0.03] text-[var(--muted)]"
            : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
        }`}
        title={enviado ? "Já enviado hoje — clique pra enviar de novo" : "Abrir WhatsApp com a mensagem"}
      >
        💬 {formatarTelefone(telefone)}
        {enviado && <span className="text-[var(--green)]">✓</span>}
      </button>
    </form>
  );
}
