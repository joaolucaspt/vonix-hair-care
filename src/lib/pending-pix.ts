/** Keep only a single pending Pix payment in sessionStorage. A page reload
 * must not create another Appmax order or Pix charge just to view the QR code.
 * This is scoped to the current browser tab (not a cross-device payment lock).
 */
export type PendingPix = {
  orderId: number;
  statusToken: string;
  total: number;
  emv: string;
  qrcode: string;
  expiresAt: string;
};

export const PENDING_PIX_KEY = "vonix-pix-verification-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function clearPendingPix(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_PIX_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function savePendingPix(pix: PendingPix, now = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_PIX_KEY, JSON.stringify({ ...pix, savedAt: now }));
  } catch {
    // Disabled session storage must not crash the payment screen.
  }
}

export function restorePendingPix(now = Date.now()): PendingPix | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PIX_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof value["savedAt"] !== "number" ||
      !Number.isFinite(value["savedAt"]) ||
      now < value["savedAt"] ||
      now - value["savedAt"] >= MAX_AGE_MS ||
      typeof value["orderId"] !== "number" ||
      !Number.isSafeInteger(value["orderId"]) ||
      value["orderId"] <= 0 ||
      typeof value["statusToken"] !== "string" ||
      value["statusToken"].length < 16 ||
      value["statusToken"].length > 128 ||
      typeof value["total"] !== "number" ||
      !Number.isFinite(value["total"]) ||
      value["total"] < 0 ||
      typeof value["emv"] !== "string" ||
      value["emv"].length === 0 ||
      value["emv"].length > 6000 ||
      typeof value["qrcode"] !== "string" ||
      value["qrcode"].length === 0 ||
      value["qrcode"].length > 150_000 ||
      typeof value["expiresAt"] !== "string" ||
      value["expiresAt"].length === 0 ||
      value["expiresAt"].length > 80
    ) {
      clearPendingPix();
      return null;
    }
    return {
      orderId: value["orderId"],
      statusToken: value["statusToken"],
      total: value["total"],
      emv: value["emv"],
      qrcode: value["qrcode"],
      expiresAt: value["expiresAt"],
    };
  } catch {
    clearPendingPix();
    return null;
  }
}
