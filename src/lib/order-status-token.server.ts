import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env.server";

/** A signed, short-lived-to-the-order capability for polling only the order just created.
 * No CPF, email, address or API credential is exposed.
 */
export function orderStatusToken(orderId: number): string {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new Error("ID de pedido inválido");
  return createHmac("sha256", requireEnv("APPMAX_CLIENT_SECRET"))
    .update(`vonix:order-status:v1:${orderId}`)
    .digest("base64url");
}

export function validOrderStatusToken(orderId: number, provided: string): boolean {
  if (typeof provided !== "string" || provided.length > 128) return false;
  try {
    const expected = Buffer.from(orderStatusToken(orderId));
    const received = Buffer.from(provided);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
