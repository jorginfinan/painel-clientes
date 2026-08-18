import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { getUsuarioAtual } from "@/lib/auth";
import { BrandFull } from "@/components/Brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // Só redireciona se a sessão for realmente válida (usuário existe).
  const u = await getUsuarioAtual();
  if (u) redirect(u.role === "admin" ? "/admin" : "/cliente");

  const { erro } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="animate-in mb-7 text-center">
          <BrandFull />
          <p className="mt-4 text-sm text-[var(--muted)]">
            Acompanhe seu sistema e pagamentos
          </p>
        </div>

        <form action={login} className="animate-in animate-in-delay-2 card space-y-4 p-6">
          {erro && (
            <p className="chip-red rounded-lg px-3 py-2 text-sm">{erro}</p>
          )}

          <div>
            <label className="label">E-mail</label>
            <input name="email" type="email" required autoComplete="email" className="field" />
          </div>

          <div>
            <label className="label">Senha</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="field"
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
