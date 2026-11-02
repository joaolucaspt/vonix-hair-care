import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
type GalleryCard = { id: string; title: string; lines: string[] };

const ZOOM = 2.4;

/**
 * Product gallery with a magnifier: on desktop the image zooms under the mouse pointer;
 * on touch screens (and on click) it opens a full-screen viewer that can be enlarged and scrolled.
 */
function CardFace({ card, photo, small }: { card: GalleryCard; photo: string; small?: boolean }) {
  return (
    <div className="relative grid h-full w-full content-center overflow-hidden p-[8%]" style={{ background: "linear-gradient(135deg, oklch(0.985 0.012 88) 0%, oklch(0.92 0.06 86) 100%)" }}>
      <img src={photo} alt="" aria-hidden className="absolute -bottom-[8%] -right-[10%] w-[52%] object-contain opacity-90 mix-blend-multiply" />
      <div className={small ? "text-[0.6rem] font-semibold uppercase leading-tight" : "text-small font-semibold uppercase tracking-[0.2em] text-muted-foreground"}>{small ? card.title : "Vonix Hair"}</div>
      {!small && (
        <>
          <div className="mt-1 font-display text-h2 leading-tight">{card.title}</div>
          <ul className="mt-4 grid max-w-[68%] gap-2 text-body">
            {card.lines.map((l) => (
              <li key={l} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-action" />{l}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ProductGallery({ images, name, cards = [] }: { images: string[]; name: string; cards?: GalleryCard[] }) {
  const photo = images[0]!;
  const slides: ({ kind: "img"; src: string; detail?: boolean } | { kind: "card"; card: GalleryCard })[] = [
    ...images.map((src) => ({ kind: "img" as const, src })),
    ...(cards.length ? [{ kind: "img" as const, src: photo, detail: true }] : []),
    ...cards.map((card) => ({ kind: "card" as const, card })),
  ];
  const [i, setI] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const n = slides.length;
  const cur = slides[i]!;
  const go = useCallback((d: number) => { setI((c) => (c + d + n) % n); setBig(false); }, [n]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight" && n > 1) go(1);
      if (e.key === "ArrowLeft" && n > 1) go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener("keydown", onKey);
    };
  }, [open, go, n]);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-label="Ampliar imagem do produto"
        onPointerMove={move}
        onPointerLeave={() => setPos(null)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-card-image"
      >
        {cur.kind === "img" ? (
          <img
            src={cur.src}
            alt={name}
            width={800}
            height={800}
            fetchPriority="high"
            draggable={false}
            style={pos ? { transform: `scale(${cur.detail ? ZOOM * 1.4 : ZOOM})`, transformOrigin: `${pos.x}% ${pos.y}%` } : cur.detail ? { transform: "scale(1.9)", transformOrigin: "50% 42%" } : undefined}
            className={`aspect-square w-full object-contain ${pos ? "" : "transition-transform duration-200"}`}
          />
        ) : (
          <div className="aspect-square w-full"><CardFace card={cur.card} photo={photo} /></div>
        )}
        <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-small font-semibold shadow">
          <ZoomIn className="h-4 w-4" aria-hidden="true" /> Ampliar
        </span>
        {n > 1 && (
          <>
            <button type="button" aria-label="Imagem anterior" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Próxima imagem" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2.5 py-1 text-small text-background">{i + 1}/{n}</span>
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {slides.map((sl, k) => (
          <button key={k} type="button" aria-label={`Ver imagem ${k + 1}`} onClick={() => { setI(k); setBig(false); }} className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-card-image ${k === i ? "border-foreground" : "border-transparent"}`}>
            {sl.kind === "img" ? (
              <img src={sl.src} alt="" loading="lazy" className="h-full w-full object-cover" style={sl.detail ? { transform: "scale(1.9)", transformOrigin: "50% 42%" } : undefined} />
            ) : (
              <CardFace card={sl.card} photo={photo} small />
            )}
          </button>
        ))}
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={`${name}: imagem ampliada`} className="fixed inset-0 z-[70] flex flex-col bg-black/95">
          <div className="flex items-center justify-between gap-2 p-3 text-white">
            <span className="text-body">{i + 1} de {n} · {big ? "arraste para ver os detalhes" : "toque na imagem para ampliar"}</span>
            <div className="flex gap-2">
              <button type="button" aria-label={big ? "Reduzir" : "Ampliar"} onClick={() => setBig((b) => !b)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
                {big ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </button>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto" onClick={() => setBig((b) => !b)}>
            <div className={`flex min-h-full min-w-full items-center justify-center ${big ? "" : "h-full"}`}>
              {cur.kind === "img" ? (
                <img
                  src={cur.src}
                  alt={name}
                  draggable={false}
                  style={big ? { width: `${ZOOM * 100}%`, maxWidth: "none" } : undefined}
                  className={big ? "h-auto cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
                />
              ) : (
                <div className="aspect-square w-full max-w-[min(92vw,80vh)] overflow-hidden rounded-2xl"><CardFace card={cur.card} photo={photo} /></div>
              )}
            </div>
          </div>
          {n > 1 && (
            <>
              <button type="button" aria-label="Imagem anterior" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button type="button" aria-label="Próxima imagem" onClick={() => go(1)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
