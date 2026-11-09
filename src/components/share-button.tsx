import { Check, Facebook, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

/**
 * Compartilhar um link (produto ou avaliação). No celular abre o compartilhar do próprio aparelho;
 * onde ele não existe (computador), abre um menu com WhatsApp, Facebook, e-mail e copiar link.
 */
export function ShareButton({
  url,
  title,
  text,
  label = "Compartilhar",
  className = "",
  compact = false,
}: {
  url: string;
  title: string;
  text?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toRight, setToRight] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const msg = text ?? title;

  useEffect(() => {
    if (!open) return;
    // O menu abre para a direita do botão; se não couber na tela (coluna da direita no celular), abre para a esquerda.
    if (box.current) setToRight(box.current.getBoundingClientRect().left + 240 > document.documentElement.clientWidth - 8);
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const press = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: msg, url });
        track("share", { method: "nativo", url });
      } catch {
        /* pessoa fechou o compartilhar: tudo bem */
      }
      return;
    }
    setOpen((o) => !o);
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        toast.success("Link copiado");
        track("share", { method: "copiar", url });
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => toast.error("Não foi possível copiar. Copie o endereço da barra do navegador."));
  };

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body hover:bg-muted";
  const enc = encodeURIComponent;
  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={press}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border border-border bg-white font-medium text-foreground transition-colors hover:border-foreground ${compact ? "min-h-11 px-3 py-2.5 text-small" : "min-h-11 px-4 py-2.5 text-body"}`}
      >
        <Share2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" /> {label}
      </button>
      {open && (
        <div role="menu" aria-label="Compartilhar" className={`absolute ${toRight ? "right-0" : "left-0"} z-50 mt-2 w-60 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-white p-1.5 shadow-xl`}>
          <a role="menuitem" className={item} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${enc(`${msg} ${url}`)}`} onClick={() => track("share", { method: "whatsapp", url })}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </a>
          <a role="menuitem" className={item} target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} onClick={() => track("share", { method: "facebook", url })}>
            <Facebook className="h-4 w-4" aria-hidden="true" /> Facebook
          </a>
          <a role="menuitem" className={item} href={`mailto:?subject=${enc(title)}&body=${enc(`${msg}\n${url}`)}`} onClick={() => track("share", { method: "email", url })}>
            <Mail className="h-4 w-4" aria-hidden="true" /> E-mail
          </a>
          <button role="menuitem" type="button" className={item} onClick={copy}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />} {copied ? "Link copiado" : "Copiar link"}
          </button>
        </div>
      )}
    </div>
  );
}
