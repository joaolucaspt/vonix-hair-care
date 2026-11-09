import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { env } from "./env.server";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const cookieName = () =>
  process.env["NODE_ENV"] === "production"
    ? "__Host-vonix-affiliates-admin"
    : "vonix-affiliates-admin-dev";

function sessionSigningKey(): Buffer | null {
  const secret = env("AFFILIATE_ADMIN_SESSION_SECRET");
  const password = env("AFFILIATE_ADMIN_PASSWORD");
  const otpSecret = env("AFFILIATE_ADMIN_TOTP_SECRET");
  if (secret.length < 32 || password.length < 16) return null;
  // Rotating any authentication factor immediately invalidates previous cookies.
  return createHmac("sha256", secret)
    .update("vonix-affiliates-admin:v1:")
    .update(password)
    .update(":")
    .update(otpSecret)
    .digest();
}

export function createAffiliateSessionToken(
  key: Buffer,
  now = Date.now(),
  nonce = randomBytes(24).toString("base64url"),
): string {
  const body = ["v1", String(now), String(now + SESSION_TTL_MS), nonce].join(".");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return body + "." + signature;
}

export function verifyAffiliateSessionToken(
  token: string | null | undefined,
  key: Buffer | null,
  now = Date.now(),
): boolean {
  if (!token || !key || token.length > 320) return false;
  const parts = token.split(".");
  if (
    parts.length !== 5 ||
    parts[0] !== "v1" ||
    !/^\d{13}$/.test(parts[1] ?? "") ||
    !/^\d{13}$/.test(parts[2] ?? "") ||
    !/^[a-zA-Z0-9_-]{32}$/.test(parts[3] ?? "") ||
    !/^[a-zA-Z0-9_-]{43}$/.test(parts[4] ?? "")
  )
    return false;
  const issued = Number(parts[1]);
  const expires = Number(parts[2]);
  if (
    !Number.isSafeInteger(issued) ||
    !Number.isSafeInteger(expires) ||
    issued > now + 5_000 ||
    now >= expires ||
    expires - issued !== SESSION_TTL_MS
  )
    return false;
  const body = parts.slice(0, 4).join(".");
  const expected = createHmac("sha256", key).update(body).digest();
  const received = Buffer.from(parts[4]!, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function base32Decode(secret: string): Buffer | null {
  const value = secret.toUpperCase().replace(/\s+/g, "").replace(/=+$/, "");
  if (!/^[A-Z2-7]{32,128}$/.test(value)) return null;
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const symbol of value) {
    const digit = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(symbol);
    if (digit < 0) return null;
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 255);
    }
  }
  return Buffer.from(output);
}

export function verifyAffiliateTotp(code: string, base32Secret: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(base32Secret);
  if (!secret) return false;
  const counter = Math.floor(now / 30_000);
  let matched = false;
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step < 0) continue;
    const payload = Buffer.alloc(8);
    payload.writeBigUInt64BE(BigInt(step));
    const digest = createHmac("sha1", secret).update(payload).digest();
    const offset = digest[digest.length - 1]! & 15;
    const dynamic =
      ((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!;
    const expected = String(dynamic % 1_000_000).padStart(6, "0");
    const actualBytes = Buffer.from(code);
    const expectedBytes = Buffer.from(expected);
    matched = timingSafeEqual(actualBytes, expectedBytes) || matched;
  }
  return matched;
}

/** Browser origin must match the request origin on every state-changing admin action. */
export function affiliateAdminOriginAllowed(
  requestOrigin: string | null,
  requestUrl: string,
): boolean {
  if (!requestOrigin) return false;
  try {
    const allowed = new URL(requestUrl);
    const supplied = new URL(requestOrigin);
    return (
      supplied.origin === allowed.origin &&
      (allowed.protocol === "https:" ||
        allowed.hostname === "127.0.0.1" ||
        allowed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

export function affiliateAdminSameOrigin(): boolean {
  const request = getRequest();
  return affiliateAdminOriginAllowed(request.headers.get("origin"), request.url);
}

export function affiliateAdminSecondFactorValid(code: string): boolean {
  const configured = env("AFFILIATE_ADMIN_TOTP_SECRET");
  if (!configured) return process.env["NODE_ENV"] !== "production";
  return verifyAffiliateTotp(code, configured);
}

export function createAffiliateAdminSession(): boolean {
  const key = sessionSigningKey();
  if (!key) return false;
  setCookie(cookieName(), createAffiliateSessionToken(key), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export function affiliateAdminSessionValid(): boolean {
  return verifyAffiliateSessionToken(getCookie(cookieName()), sessionSigningKey());
}

export function destroyAffiliateAdminSession(): void {
  deleteCookie(cookieName(), {
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    sameSite: "strict",
    httpOnly: true,
  });
}

/** For diagnostics only: never expose tokens or signing material. */
export function affiliateSessionConfiguration() {
  return {
    ready:
      sessionSigningKey() !== null &&
      (process.env["NODE_ENV"] !== "production" || env("AFFILIATE_ADMIN_TOTP_SECRET").length >= 32),
    requiresTwoFactor: Boolean(env("AFFILIATE_ADMIN_TOTP_SECRET")),
    ttlMinutes: SESSION_TTL_MS / 60000,
  };
}
