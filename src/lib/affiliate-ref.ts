/**
 * Código de indicação da afiliada (?ref=isabela).
 *
 * Vale só para a visita em que a pessoa abriu o link da afiliada: fica na aba (sessionStorage) e some quando a
 * aba é fechada. Abrir o site de novo, sem o link, não conta mais para ela. Antes o código ficava 30 dias no
 * navegador (localStorage) e marcava toda compra feita depois, mesmo sem passar pelo link.
 */
const KEY = "vonix-ref";

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

export function captureRef(search: string) {
  if (typeof window === "undefined") return;
  dropLegacy();
  const ref = normalizeRef(new URLSearchParams(search).get("ref"));
  if (!ref) return;
  try { sessionStorage.setItem(KEY, ref); } catch { /* sem armazenamento */ }
}

export function getRef(): string | null {
  if (typeof window === "undefined") return null;
  dropLegacy();
  try { return normalizeRef(sessionStorage.getItem(KEY)); } catch { return null; }
}

/** Marca gravada como origem do pedido; o app de expedição procura por ela para ligar a venda à afiliada. */
export const refCampaign = (ref: string) => `afiliada-${ref}`;
