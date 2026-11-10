/**
 * A session-only, non-PII record of the exact basket submitted for an order.
 * This never authorizes payment or proves that an order was paid: Appmax's
 * authenticated status remains the source of truth. It only prevents a
 * delayed payment confirmation from deleting a newer, unrelated cart.
 */
export type PurchaseBasketLine = {
  slug: string;
  variant: string;
  qty: number;
  offer?: "comp5" | "kit2" | "kit3";
};

export const PENDING_PURCHASE_BASKET_KEY = "vonix-confirmed-basket-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

function validLine(value: unknown): value is PurchaseBasketLine {
  if (!value || typeof value !== "object") return false;
  const line = value as { slug?: unknown; variant?: unknown; qty?: unknown; offer?: unknown };
  return (
    typeof line.slug === "string" &&
    line.slug.length > 0 &&
    line.slug.length <= 120 &&
    typeof line.variant === "string" &&
    line.variant.length > 0 &&
    line.variant.length <= 120 &&
    Number.isSafeInteger(line.qty) &&
    (line.qty as number) >= 1 &&
    (line.qty as number) <= 99 &&
    (line.offer === undefined || ["comp5", "kit2", "kit3"].includes(line.offer as string))
  );
}

function validLines(value: unknown): value is PurchaseBasketLine[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(validLine);
}

export function savePurchaseBasket(
  orderId: number,
  lines: PurchaseBasketLine[],
  now = Date.now(),
): void {
  if (typeof sessionStorage === "undefined") return;
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !validLines(lines)) return;
  try {
    sessionStorage.setItem(
      PENDING_PURCHASE_BASKET_KEY,
      JSON.stringify({ orderId, lines, savedAt: now }),
    );
  } catch {
    // Private storage failure must not stop the payment result from displaying.
    // Without a recorded snapshot, never clear the current cart automatically.
  }
}

export function restorePurchaseBasket(
  orderId: number,
  now = Date.now(),
): PurchaseBasketLine[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as { orderId?: unknown; savedAt?: unknown; lines?: unknown };
    if (
      !Number.isSafeInteger(snapshot.orderId) ||
      snapshot.orderId !== orderId ||
      typeof snapshot.savedAt !== "number" ||
      !Number.isFinite(snapshot.savedAt) ||
      snapshot.savedAt > now ||
      now - snapshot.savedAt >= TTL_MS ||
      !validLines(snapshot.lines)
    )
      return null;
    return snapshot.lines.map((line) => ({
      slug: line.slug,
      variant: line.variant,
      qty: line.qty,
      ...(line.offer ? { offer: line.offer } : {}),
    }));
  } catch {
    return null;
  }
}

export function clearPurchaseBasket(orderId: number): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY);
    if (!raw) return;
    const value = JSON.parse(raw) as { orderId?: unknown };
    if (value.orderId === orderId) sessionStorage.removeItem(PENDING_PURCHASE_BASKET_KEY);
  } catch {
    // Never throw during payment completion.
  }
}

const signature = (line: PurchaseBasketLine) =>
  JSON.stringify([line.slug, line.variant, line.qty, line.offer ?? null]);

export function matchesPurchaseBasket(
  current: PurchaseBasketLine[],
  submitted: PurchaseBasketLine[] | null,
): boolean {
  if (!submitted || !validLines(submitted) || !validLines(current)) return false;
  if (current.length !== submitted.length) return false;
  const actual = current.map(signature).sort();
  const expected = submitted.map(signature).sort();
  return actual.every((line, index) => line === expected[index]);
}
