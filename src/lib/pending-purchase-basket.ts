/**
 * Non-personal product identity recorded only in this browser tab. Payment
 * approval still comes solely from Appmax's authenticated order status.
 */
export type PurchaseBasketLine = {
  slug: string;
  variant: string;
  qty: number;
  offer?: "comp5" | "kit2" | "kit3";
};

export const PENDING_PURCHASE_BASKET_KEY = "vonix-confirmed-basket-v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ORDERS = 8;

type BasketSnapshot = {
  orderId: number;
  lines: PurchaseBasketLine[];
  savedAt: number;
};

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

function normalizedLines(lines: PurchaseBasketLine[]): PurchaseBasketLine[] {
  return lines.map((line) => ({
    slug: line.slug,
    variant: line.variant,
    qty: line.qty,
    ...(line.offer ? { offer: line.offer } : {}),
  }));
}

function parseSnapshot(value: unknown, now?: number): BasketSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { orderId?: unknown; lines?: unknown; savedAt?: unknown };
  if (
    !Number.isSafeInteger(item.orderId) ||
    (item.orderId as number) <= 0 ||
    typeof item.savedAt !== "number" ||
    !Number.isFinite(item.savedAt) ||
    (now !== undefined && (item.savedAt > now || now - item.savedAt >= TTL_MS)) ||
    !validLines(item.lines)
  )
    return null;
  return {
    orderId: item.orderId as number,
    savedAt: item.savedAt,
    lines: normalizedLines(item.lines),
  };
}

/** Read both the old single-order C37 format and the bounded C39 format.
 * A corrupt or stale entry can never authorize clearing another order.
 */
function readSnapshots(now?: number): BasketSnapshot[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    const value = data as { version?: unknown; entries?: unknown } | null;
    const source =
      value && value.version === 2 && Array.isArray(value.entries)
        ? value.entries.slice(0, MAX_ORDERS * 4)
        : [data];
    const unique = new Map<number, BasketSnapshot>();
    for (const entry of source) {
      const parsed = parseSnapshot(entry, now);
      if (!parsed) continue;
      const previous = unique.get(parsed.orderId);
      if (!previous || previous.savedAt <= parsed.savedAt) unique.set(parsed.orderId, parsed);
    }
    return [...unique.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ORDERS);
  } catch {
    return [];
  }
}

/** Remember a newly created Pix/card order without overwriting older orders.
 * Keep at most eight 24-hour snapshots in sessionStorage to bound retention.
 */
export function savePurchaseBasket(
  orderId: number,
  lines: PurchaseBasketLine[],
  now = Date.now(),
): void {
  if (typeof sessionStorage === "undefined") return;
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !validLines(lines)) return;
  try {
    const previous = readSnapshots(now).filter((entry) => entry.orderId !== orderId);
    const entries = [{ orderId, savedAt: now, lines: normalizedLines(lines) }, ...previous]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_ORDERS);
    sessionStorage.setItem(PENDING_PURCHASE_BASKET_KEY, JSON.stringify({ version: 2, entries }));
  } catch {
    // Storage may be disabled; the checkout must never clear a cart by guess.
  }
}

export function restorePurchaseBasket(
  orderId: number,
  now = Date.now(),
): PurchaseBasketLine[] | null {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  const found = readSnapshots(now).find((entry) => entry.orderId === orderId);
  return found ? normalizedLines(found.lines) : null;
}

/** Clear only the confirmed order's snapshot, preserving other pending orders.
 * No TTL filter here: even synthetic historical timestamps cannot silently
 * erase unrelated entries. Expiration is enforced on the next save/restore.
 */
export function clearPurchaseBasket(orderId: number): void {
  if (typeof sessionStorage === "undefined") return;
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return;
  try {
    const all = readSnapshots();
    if (!all.some((entry) => entry.orderId === orderId)) return;
    const remaining = all.filter((entry) => entry.orderId !== orderId);
    if (remaining.length)
      sessionStorage.setItem(
        PENDING_PURCHASE_BASKET_KEY,
        JSON.stringify({ version: 2, entries: remaining }),
      );
    else sessionStorage.removeItem(PENDING_PURCHASE_BASKET_KEY);
  } catch {
    // Payment status remains authoritative even if private storage is blocked.
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
