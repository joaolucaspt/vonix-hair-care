import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env.server";

/** Signed, short-lived, read-only capability for a single Appmax order.
 * A leaked token must not remain useful forever.
 */
const STATUS_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;

function signature(orderId: number, issuedAt: number): string {
  return createHmac("sha256", requireEnv("APPMAX_CLIENT_SECRET"))
    .update(`vonix:order-status:v2:${orderId}:${issuedAt}`)
    .digest("base64url");
}

export function orderStatusToken(orderId: number, now = Date.now()): string {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new Error("ID de pedido inválido");
  if (!Number.isFinite(now) || now < 0) throw new Error("Horário inválido");
  const issuedAt = Math.floor(now / 1000);
  return `v2.${issuedAt.toString(36)}.${signature(orderId, issuedAt)}`;
}

export function validOrderStatusToken(
  orderId: number,
  provided: string,
  now = Date.now(),
): boolean {
  if (
    !Number.isSafeInteger(orderId) ||
    orderId <= 0 ||
    !Number.isFinite(now) ||
    now < 0 ||
    typeof provided !== "string" ||
    provided.length > 128
  )
    return false;
  const matches = /^v2\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/.exec(provided);
  if (!matches) return false;
  const issuedAt = Number.parseInt(matches[1]!, 36);
  const current = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt <= 0 ||
    issuedAt > current + CLOCK_SKEW_SECONDS ||
    current - issuedAt > STATUS_TOKEN_TTL_SECONDS
  )
    return false;
  try {
    const expected = Buffer.from(signature(orderId, issuedAt));
    const received = Buffer.from(matches[2]!);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
