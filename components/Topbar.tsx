import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { BrandMark, BrandWord } from "@/components/Brand";

export function Topbar({
  nome,
  role,
}: {
  nome: string;
  role: "admin" | "cliente";
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05060b]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href={role === "admin" ? "/admin" : "/cliente"}
          className="flex items-center gap-2.5"
        >
          <BrandMark size={32} />
          <BrandWord className="text-lg text-[var(--text)]" />
          {role === "admin" && (
            <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Admin
            </span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--muted)] sm:inline">
            {nome}
          </span>
          <form action={logout}>
            <button className="btn-ghost">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
