import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const clase =
  "fixed right-4 z-30 flex h-14 items-center gap-2 rounded-2xl bg-primario pr-5 pl-4 text-[15px] font-semibold text-primario-texto shadow-lg shadow-black/25 active:brightness-95 md:hidden [&_svg]:size-6";
const posicion = { bottom: "calc(env(safe-area-inset-bottom) + 84px)" };

/**
 * Botón flotante con la acción principal de la pantalla (solo en el móvil, sobre la navegación inferior).
 * En escritorio esa acción va en la cabecera.
 */
export function Fab({ icono, children, to, onClick }: { icono: ReactNode; children: ReactNode; to?: string; onClick?: () => void }) {
  const contenido = (
    <>
      {icono}
      {children}
    </>
  );
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
      {to ? (
        <Link to={to} className={clase} style={posicion}>
          {contenido}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={clase} style={posicion}>
          {contenido}
        </button>
      )}
    </motion.div>
  );
}
