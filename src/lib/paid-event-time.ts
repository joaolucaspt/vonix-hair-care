/** A verified order status alone does not establish when the charge occurred.
 * A paid Purchase must not be attributed to the current recovery run.
 * Only timezone-aware merchant timestamps inside Meta's accepted attribution
 * window are eligible. No fallback to Date.now or checkout creation time.
 */
export function paidEventTimestamp(value: unknown, nowSeconds = Math.floor(Date.now() / 1000)): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/i.test(value)
  ) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const seconds = Math.floor(parsed / 1000);
  if (!Number.isSafeInteger(seconds) || seconds < nowSeconds - 6 * 24 * 3600 || seconds > nowSeconds + 60)
    return null;
  return seconds;
}
