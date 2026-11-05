/** Código de indicação da afiliada (?ref=isabela). Fica salvo por 30 dias e vai junto do pedido para contar a venda dela. */
const KEY = "vonix-ref";
const DAYS = 30;

/** Só letras minúsculas, números e hífen, até 30 caracteres. Qualquer outra coisa é descartada. */
export function normalizeRef(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toLowerCase().trim();
  return /^[a-z0-9-]{1,30}$/.test(s) ? s : null;
}

export function captureRef(search: string, now = Date.now()) {
  if (typeof window === "undefined") return;
  const ref = normalizeRef(new URLSearchParams(search).get("ref"));
  if (!ref) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ref, until: now + DAYS * 86_400_000 })); } catch { /* sem armazenamento */ }
}

export function getRef(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { ref?: unknown; until?: number } | null;
    if (!v || typeof v.until !== "number" || v.until < now) return null;
    return normalizeRef(v.ref);
  } catch { return null; }
}

/** Marca gravada como origem do pedido; o app de expedição procura por ela para ligar a venda à afiliada. */
export const refCampaign = (ref: string) => `afiliada-${ref}`;
