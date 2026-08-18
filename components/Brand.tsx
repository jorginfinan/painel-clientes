/* eslint-disable @next/next/no-img-element */

// Marca da Koryva. As imagens ficam em /public:
//   public/koryva-icon.png  -> ícone (o "K")
//   public/koryva-logo.png  -> logo completo com texto
// Exibidas sobre fundo branco arredondado, pois a arte é feita pra fundo claro.

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-white shadow-[0_0_18px_rgba(255,120,20,0.25)]"
      style={{ width: size, height: size, padding: size * 0.12 }}
    >
      <img
        src="/koryva-icon.png"
        alt="Koryva"
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandFull() {
  return (
    <div className="mx-auto inline-flex rounded-2xl bg-white p-4 shadow-[0_10px_40px_-10px_rgba(255,120,20,0.35)]">
      <img
        src="/koryva-logo.png"
        alt="Koryva — Tecnologia & Soluções"
        className="h-20 w-auto"
      />
    </div>
  );
}

// Texto "KORYVA" estilizado (pro tema escuro, quando não se usa a imagem).
export function BrandWord({ className = "" }: { className?: string }) {
  return (
    <span className={`brand font-bold ${className}`}>
      KOR<span className="text-orange-500">Y</span>VA
    </span>
  );
}
