import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  TRACKING_PREFERENCES_EVENT,
  getTrackingConsent,
  saveTrackingConsent,
  type TrackingConsent,
} from "@/lib/tracking-consent";

/**
 * No trackers load before optional consent. The reload after choosing a
 * preference activates/removes the vendor scripts from a clean document.
 */
export function TrackingConsentBanner() {
  const path = useLocation({ select: (location) => location.pathname });
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<TrackingConsent | null>(null);
  const [explicitlyOpened, setExplicitlyOpened] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = getTrackingConsent();
    setChoice(current);
    setOpen(current === null);
    const reopen = () => {
      setError("");
      setExplicitlyOpened(true);
      setOpen(true);
    };
    window.addEventListener(TRACKING_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(TRACKING_PREFERENCES_EVENT, reopen);
  }, []);

  const choose = (next: TrackingConsent) => {
    if (!saveTrackingConsent(next)) {
      if (next === "rejected") {
        // Even without either storage API, allow essential-only browsing in this tab.
        // If scripts were previously loaded, reload to stop their execution.
        setChoice("rejected");
        setOpen(false);
        if (window.gtag || window.fbq || window.clarity) window.location.reload();
        return;
      }
      setError(
        "Não foi possível salvar a preferência neste navegador. O rastreamento opcional permanece desativado.",
      );
      return;
    }
    setError("");
    setChoice(next);
    setOpen(false);
    setExplicitlyOpened(false);
    // Discard scripts already loaded when revoking; enable them only after
    // accepting. Consent is read synchronously before any vendor bootstrap.
    window.location.reload();
  };

  // Never block checkout with an unsolicited banner, but let the buyer
  // explicitly reopen preferences from the footer even while checking out.
  if (!open || (path === "/checkout" && !explicitlyOpened)) return null;

  return (
    <section
      role="region"
      aria-label="Preferências de privacidade"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-border bg-white p-4 text-foreground shadow-2xl sm:p-5"
    >
      <h2 className="text-name font-semibold">Privacidade e cookies</h2>
      <p className="mt-2 text-small leading-relaxed text-muted-foreground">
        Usamos recursos necessários para o carrinho e a compra. Com a sua permissão, também usamos
        Google Analytics, Microsoft Clarity e Meta Pixel para medir visitas e melhorar a loja. Você
        pode recusar sem perder acesso aos produtos ou ao checkout.
      </p>
      <p className="mt-1 text-small text-muted-foreground">
        Sua escolha atual:{" "}
        {choice === "accepted"
          ? "opcionais ativados"
          : choice === "rejected"
            ? "somente necessários"
            : "não definida"}
        .{" "}
        <Link
          to="/$page"
          params={{ page: "politica-de-privacidade" }}
          className="underline underline-offset-2"
        >
          Política de Privacidade
        </Link>
      </p>
      {error && (
        <p role="alert" className="mt-2 text-small text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose("rejected")}
          className="min-h-11 flex-1 rounded-full border border-border px-5 py-2.5 text-small font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Recusar opcionais
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="min-h-11 flex-1 rounded-full bg-foreground px-5 py-2.5 text-small font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Aceitar opcionais
        </button>
      </div>
    </section>
  );
}
