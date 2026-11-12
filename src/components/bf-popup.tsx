import { Link, useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BF_DATA_ABERTURA, bfEsquentaAberto } from "@/lib/black-friday";
import { VIP_DONE_KEY } from "@/components/bf-vip-form";

const SEEN = "vonix-bf-aviso-fechado";

/** Aviso do esquenta da Black Friday (no lugar da roleta): aparece uma vez, leva para a página da lista VIP. */
export function BfPopup() {
  const path = useLocation().pathname;
  const hidden =
    path === "/carrinho" ||
    path === "/checkout" ||
    path === "/conta" ||
    path === "/auth" ||
    path === "/esquenta-black-friday" ||
    path.startsWith("/produto/");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hidden || !bfEsquentaAberto()) return;
    try {
      if (localStorage.getItem(SEEN) === "1" || localStorage.getItem(VIP_DONE_KEY)) return;
    } catch {
      /* sem armazenamento: mostra mesmo assim */
    }
    const t = setTimeout(() => setOpen(true), 20000);
    return () => clearTimeout(t);
  }, [hidden]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close]);

  if (hidden || !open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Esquenta Black Friday" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={close}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 rounded-full p-1.5 text-[#c72c8e]">
          <X className="h-5 w-5" />
        </button>
        <p className="text-small uppercase tracking-widest text-[#c9992f]">Esquenta Black Friday</p>
        <h2 className="mt-1">A Black Friday abre dia {BF_DATA_ABERTURA}</h2>
        <p className="mt-2 text-body text-muted-foreground">Entre na lista VIP e saiba primeiro: Botox, Progressiva Fio de Luz e kits.</p>
        <Link to="/esquenta-black-friday" onClick={close} className="mt-5 block rounded-lg bg-[#5a0e4d] py-3 font-semibold text-white">
          Entrar na lista VIP
        </Link>
        <button type="button" onClick={close} className="mt-2 text-small text-muted-foreground underline">
          Agora não
        </button>
      </div>
    </div>
  );
}
