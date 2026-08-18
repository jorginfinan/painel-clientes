import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { montarFilaHoje } from "@/lib/lembrete";
import * as db from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  if (u.role !== "admin") redirect("/cliente");

  // contador de lembretes pendentes hoje (pra aba)
  const fila = montarFilaHoje(await db.listClientes(), await db.listSistemas(), await db.listPagamentos());
  const enviados = await db.listLembretes();
  const hj = new Date().toISOString().slice(0, 10);
  const pendentes = fila.filter(
    (i) =>
      i.telefones.length > 0 &&
      !i.telefones.every((t) =>
        enviados.some(
          (l) => l.pagamento_id === i.pagamentoId && l.tipo === i.tipo && l.telefone === t && l.data === hj
        )
      )
  ).length;

  return (
    <div className="min-h-screen">
      <Topbar nome={u.nome} role="admin" />
      <nav className="border-b border-white/10 bg-[#05060b]/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-5 px-4 py-2.5 text-sm">
          <Link href="/admin" className="nav-link">
            Resumo
          </Link>
          <Link href="/admin/clientes" className="nav-link">
            Clientes
          </Link>
          <Link href="/admin/proprios" className="nav-link">
            Sistemas próprios
          </Link>
          <Link
            href="/admin/lembretes"
            className="nav-link inline-flex items-center gap-1.5"
          >
            Lembretes
            {pendentes > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {pendentes}
              </span>
            )}
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
