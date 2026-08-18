import Link from "next/link";

export function Voltar({ href = "/cliente", label = "Voltar ao resumo" }) {
  return (
    <Link href={href} className="text-sm text-cyan-300 transition hover:text-cyan-200">
      ← {label}
    </Link>
  );
}
