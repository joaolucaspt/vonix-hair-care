import { Check, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { addToSummary } from "@/lib/review-summary";
import { submitReview, type PublicReview } from "@/lib/reviews.functions";
import { ShareButton } from "@/components/share-button";
import { SITE_URL } from "@/lib/store";

const SENT_KEY = "vonix-avaliou";
const LABELS = ["", "Ruim", "Regular", "Bom", "Muito bom", "Ótimo"];

/**
 * "Avaliar este produto": qualquer visitante pode avaliar e comentar, comprando ou não.
 * A avaliação vai para aprovação antes de aparecer no site (evita spam e ofensa). Depois de enviar, a pessoa pode compartilhar.
 */
export function ReviewForm({
  slug,
  productName,
  onPublished,
}: {
  slug: string;
  productName: string;
  onPublished?: (r: PublicReview) => void;
}) {
  const [nota, setNota] = useState(0);
  const [nome, setNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [email, setEmail] = useState("");
  const [isca, setIsca] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [publicada, setPublicada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const productGenerationRef = useRef(0);

  useEffect(() => {
    // A single SPA component can stay mounted across different products.
    productGenerationRef.current += 1;
    sendingRef.current = false;
    setNota(0);
    setNome("");
    setComentario("");
    setEmail("");
    setIsca("");
    setPublicada(false);
    setError(null);
    let sentForCurrentProduct = false;
    try {
      const stored = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as unknown;
      sentForCurrentProduct = Array.isArray(stored) && stored.includes(slug);
    } catch {
      // Storage unavailable or corrupted: permit review for the new product.
    }
    setState(sentForCurrentProduct ? "done" : "idle");
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state !== "idle" || sendingRef.current) return;
    if (nota < 1) return setError("Escolha de 1 a 5 estrelas.");
    if (nome.trim().length < 2) return setError("Digite seu nome.");
    if (comentario.trim().length < 10)
      return setError("Conte um pouco mais: escreva pelo menos 10 letras.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      return setError("Esse e-mail parece incorreto. Deixe em branco ou corrija.");
    sendingRef.current = true;
    const requestGeneration = productGenerationRef.current;
    setError(null);
    setState("sending");
    try {
      const res = await submitReview({
        data: {
          slug,
          nome: nome.trim(),
          nota,
          comentario: comentario.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(isca ? { empresa: isca } : {}),
        },
      });
      // An in-flight result for product A must not update product B.
      if (requestGeneration !== productGenerationRef.current) return;
      if (!res.ok) {
        setState("idle");
        return setError(res.motivo);
      }
      setPublicada(res.publicada);
      if (res.publicada && res.review) {
        onPublished?.(res.review);
        addToSummary(slug, res.review.rating);
      }
      try {
        const sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as string[];
        localStorage.setItem(SENT_KEY, JSON.stringify([...new Set([...sent, slug])]));
      } catch {
        /* ok */
      }
      track("submit_review", { item_id: slug, rating: nota });
      setState("done");
    } catch {
      if (requestGeneration !== productGenerationRef.current) return;
      setState("idle");
      setError("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      if (requestGeneration === productGenerationRef.current) sendingRef.current = false;
    }
  };

  const link = `${SITE_URL}/produto/${slug}#avaliacoes`;
  const field =
    "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body outline-none focus:ring-2 focus:ring-[#c9992f]";

  if (state === "done") {
    return (
      <div role="status" className="mt-6 rounded-2xl bg-[#eef8f2] p-5 text-[#1f5a45]">
        <div className="flex items-center gap-2 font-semibold">
          <Check className="h-5 w-5" aria-hidden="true" /> Avaliação enviada, obrigado!
        </div>
        <p className="mt-1 text-body">
          {publicada
            ? "Ela já está aparecendo aqui na página. Que tal contar para alguém?"
            : "Ela vai aparecer aqui depois que a gente conferir. Enquanto isso, que tal contar para alguém?"}
        </p>
        <div className="mt-3">
          <ShareButton
            url={link}
            title={`${productName} — Vonix Hair`}
            text={`Olha esse produto da Vonix Hair: ${productName}.`}
            label="Compartilhar este produto"
          />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-6 rounded-2xl border border-border bg-white p-5 md:p-6"
      aria-label={`Avaliar ${productName}`}
    >
      <h3 className="font-display text-h2 leading-tight">Avalie este produto</h3>
      <p className="mt-1 text-body text-muted-foreground">
        Qualquer pessoa pode avaliar, mesmo sem ter comprado no site. Sua opinião ajuda outras
        pessoas.
      </p>

      <div className="mt-4">
        <div className="text-body font-medium" id="nota-label">
          Sua nota
        </div>
        <div
          role="radiogroup"
          aria-labelledby="nota-label"
          className="mt-1 flex items-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              onClick={() => setNota(n)}
              className="rounded-md p-1 text-[#c9992f]"
            >
              <Star
                className={`h-8 w-8 transition-transform hover:scale-110 ${n <= nota ? "fill-current" : ""}`}
                strokeWidth={1.8}
              />
            </button>
          ))}
          {nota > 0 && (
            <span className="ml-2 text-body font-medium text-foreground">{LABELS[nota]}</span>
          )}
        </div>
      </div>

      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Empresa
          <input
            tabIndex={-1}
            autoComplete="off"
            value={isca}
            onChange={(e) => setIsca(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-body font-medium">Seu nome</span>
          <input
            className={field}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            placeholder="Como você quer aparecer"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-body font-medium">
            E-mail{" "}
            <span className="font-normal text-muted-foreground">
              (opcional, não aparece no site)
            </span>
          </span>
          <input
            className={field}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={160}
            autoComplete="email"
            placeholder="nome@email.com"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-body font-medium">Seu comentário</span>
        <textarea
          className={`${field} min-h-28 resize-y`}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={600}
          placeholder="O que você achou? Como foi o resultado?"
        />
        <span className="mt-1 block text-right text-small text-muted-foreground">
          {comentario.length}/600
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-2 text-small text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-3 rounded-full bg-action px-7 py-3 font-medium text-action-foreground disabled:opacity-60"
      >
        {state === "sending" ? "Enviando…" : "Enviar avaliação"}
      </button>
      <p className="mt-2 text-small text-muted-foreground">
        Sua avaliação passa por uma conferência automática contra spam e ofensas; se tudo estiver
        certo, aparece na hora.
      </p>
    </form>
  );
}
