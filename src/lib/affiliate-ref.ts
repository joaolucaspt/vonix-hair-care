/**
 * Código de indicação da afiliada (?ref=isabela).
 *
 * Vale só para a visita em que a pessoa abriu o link da afiliada: fica na aba (sessionStorage), some quando a
 * aba é fechada e expira em VISIT_HOURS horas (para uma aba esquecida aberta não valer no dia seguinte).
 * Entrou pelo link e comprou vários produtos na mesma visita: conta para ela. Voltar depois, sem o link: não conta.
 * Antes o código ficava 30 dias no navegador (localStorage) e marcava toda compra feita depois, mesmo sem o link.
 */
const KEY = "vonix-ref";
/** Duração máxima de uma visita aberta pelo link da afiliada. */
const VISIT_HOURS = 3;

/** Só letras minúsculas, números e hífen, até 30 caracteres. Qualquer outra coisa é descartada. */
export function normalizeRef(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toLowerCase().trim();
  return /^[a-z0-9-]{1,30}$/.test(s) ? s : null;
}

/** Apaga o código de 30 dias que versões antigas do site deixaram no navegador, para ele nunca mais valer. */
function dropLegacy() {
  try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ }
}

export function captureRef(search: string, now = Date.now()) {
  if (typeof window === "undefined") return;
  dropLegacy();
  const ref = normalizeRef(new URLSearchParams(search).get("ref"));
  if (!ref) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ ref, until: now + VISIT_HOURS * 3_600_000 })); } catch { /* sem armazenamento */ }
}

export function getRef(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  dropLegacy();
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { ref?: unknown; until?: number } | null;
    if (!v || typeof v.until !== "number" || v.until < now) return null;
    return normalizeRef(v.ref);
  } catch { return null; }
}

/** Marca gravada como origem do pedido; o app de expedição procura por ela para ligar a venda à afiliada. */
export const refCampaign = (ref: string) => `afiliada-${ref}`;
