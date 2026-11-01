import { cn } from "@/lib/utils";

/** Símbolo de ComePayá: bolsa de la compra con una hoja. */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#2f6b4f" />
      <path d="M156 196h200l-18 176a28 28 0 0 1-28 25H202a28 28 0 0 1-28-25z" fill="#f7f6f2" />
      <path d="M190 196c0-50 30-82 66-82s66 32 66 82" fill="none" stroke="#f7f6f2" strokeWidth="26" strokeLinecap="round" />
      <path d="M256 250c-22 18-30 44-22 74 30-6 48-26 52-56-10-10-20-16-30-18z" fill="#2f6b4f" />
    </svg>
  );
}

/** Símbolo + nombre. `claro` para fondos oscuros. */
export function Logo({ className, tamano = "md", claro = false }: { className?: string; tamano?: "sm" | "md" | "lg"; claro?: boolean }) {
  const marca = { sm: "size-7", md: "size-9", lg: "size-12" }[tamano];
  const texto = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[tamano];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMarca className={cn(marca, "shrink-0 rounded-[28%] shadow-sm")} />
      <span className={cn("font-titulo leading-none font-semibold tracking-tight", texto, claro ? "text-white" : "text-texto")}>
        Come<span className={claro ? "text-[#b9e6cb]" : "text-primario"}>Payá</span>
      </span>
    </span>
  );
}
