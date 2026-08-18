import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  if (u.role === "admin") redirect("/admin");

  return (
    <div className="min-h-screen">
      <Topbar nome={u.nome} role="cliente" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">{children}</main>
    </div>
  );
}
