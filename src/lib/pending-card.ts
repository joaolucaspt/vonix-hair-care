/** Only order ID, signed read-only status capability and payment state are
 * kept in the buyer's session. Never persist card numbers, CPF or address.
 */
export type PendingCard = {
  orderId: number;
  statusToken: string;
  total: number;
  paid: boolean;
  status: string;
  /** True for an unresolved order (including Pix without a QR), not an identified card charge. */
  verificationOnly?: boolean;
};

/** A server "verification" response can be from Pix, card or a duplicate
 * request made with a different payment method. Never label it as card.
 */
export function pendingPaymentFromResponse(payment: {
  method: "card" | "verification";
  orderId: number;
  statusToken: string;
  total: number;
  paid: boolean;
  status: string;
}): PendingCard {
  return {
    orderId: payment.orderId,
    statusToken: payment.statusToken,
    total: payment.total,
    paid: payment.paid,
    status: payment.status,
    ...(payment.method === "verification" ? { verificationOnly: true } : {}),
  };
}

export const PENDING_CARD_KEY = "vonix-card-verification-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

export function savePendingCard(card: PendingCard, now = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_CARD_KEY, JSON.stringify({ ...card, savedAt: now }));
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

export function restorePendingCard(now = Date.now()): PendingCard | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_CARD_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof data["savedAt"] !== "number" ||
      !Number.isFinite(data["savedAt"]) ||
      now < data["savedAt"] ||
      now - data["savedAt"] >= TTL_MS ||
      typeof data["orderId"] !== "number" ||
      !Number.isSafeInteger(data["orderId"]) ||
      data["orderId"] <= 0 ||
      typeof data["statusToken"] !== "string" ||
      data["statusToken"].length < 16 ||
      data["statusToken"].length > 128 ||
      typeof data["total"] !== "number" ||
      !Number.isFinite(data["total"]) ||
      data["total"] < 0 ||
      typeof data["paid"] !== "boolean" ||
      typeof data["status"] !== "string" ||
      data["status"].length > 100 ||
      (data["verificationOnly"] !== undefined && typeof data["verificationOnly"] !== "boolean")
    ) {
      clearPendingCard();
      return null;
    }
    return {
      orderId: data["orderId"],
      statusToken: data["statusToken"],
      total: data["total"],
      paid: data["paid"],
      status: data["status"],
      ...(data["verificationOnly"] === true ? { verificationOnly: true } : {}),
    };
  } catch {
    clearPendingCard();
    return null;
  }
}

export function clearPendingCard(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_CARD_KEY);
  } catch {
    /* best effort */
  }
}
