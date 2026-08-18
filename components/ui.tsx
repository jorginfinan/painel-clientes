import { brl } from "@/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    default: "text-[var(--text)]",
    green: "text-[var(--green)]",
    red: "text-[var(--red)]",
    blue: "neon",
  };
  return (
    <div className="card card-hover animate-in p-5">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </p>
      <p className={`tnum mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function Money({ value, tone }: { value: number; tone?: "green" | "red" }) {
  const c =
    tone === "green"
      ? "text-[var(--green)]"
      : tone === "red"
        ? "text-[var(--red)]"
        : "";
  return <span className={`tnum font-semibold ${c}`}>{brl(value)}</span>;
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="uppercase tracking-[0.08em] text-[var(--muted)]">
          Conclusão
        </span>
        <span className="tnum font-semibold text-[var(--text)]">{v}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        <div
          className="progress-fill h-full rounded-full"
          style={{
            width: `${v}%`,
            background: "linear-gradient(92deg, var(--accent), var(--accent-2))",
            boxShadow: "0 0 16px rgba(34,211,238,0.6)",
            transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "red" | "yellow" | "blue";
}) {
  const map: Record<string, string> = {
    gray: "chip-gray",
    green: "chip-green",
    red: "chip-red",
    yellow: "chip-amber",
    blue: "chip-blue",
  };
  return <span className={`chip ${map[tone]}`}>{children}</span>;
}

export const statusBadge = (status: string) => {
  if (status === "concluido") return <Badge tone="green">Concluído</Badge>;
  if (status === "pausado") return <Badge tone="yellow">Pausado</Badge>;
  return <Badge tone="blue">Em andamento</Badge>;
};
