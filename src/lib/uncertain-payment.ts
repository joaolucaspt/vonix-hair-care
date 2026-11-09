/** A lost HTTP response is NOT evidence that an Appmax charge was declined.
 * Keep a minimal, non-PII, tab-scoped marker until the checkout receives a
 * structured answer, so refreshing cannot silently invite a second payment.
 */
export const UNCERTAIN_PAYMENT_KEY = "vonix-payment-verification-required-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

export type UncertainPayment = {
  method: "pix" | "card";
  startedAt: number;
};

export function rememberPaymentAttempt(method: UncertainPayment["method"], now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(UNCERTAIN_PAYMENT_KEY, JSON.stringify({ method, startedAt: now }));
  } catch {
    // The caller also uses in-memory state on errors when storage is restricted.
  }
}

export function recoverUncertainPayment(now = Date.now()): UncertainPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    if (
      (value["method"] !== "pix" && value["method"] !== "card") ||
      typeof value["startedAt"] !== "number" ||
      !Number.isSafeInteger(value["startedAt"]) ||
      now < value["startedAt"] ||
      now - value["startedAt"] >= TTL_MS
    )
      return null;
    return { method: value["method"], startedAt: value["startedAt"] };
  } catch {
    return null;
  }
}

export function clearUncertainPayment(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(UNCERTAIN_PAYMENT_KEY);
  } catch {
    // Failure to clear a stale marker can only block another attempt, not charge.
  }
}
