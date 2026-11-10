import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { env } from "./env.server";

const MAX_AGE = 60 * 60; // 1 hour, revocation exposure is bounded.
const role = ["reviewer", "owner"] as const;
export type AffiliateMemberRole = (typeof role)[number];
export type AffiliateMemberIdentity = { email: string; role: AffiliateMemberRole };

function isLoopback() {
  if (!["development", "test"].includes(process.env["NODE_ENV"] || "")) return false;
  try {
    const url = new URL(getRequest().url);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
const cookieName = () =>
  isLoopback() ? "vonix-affiliate-member-dev" : "__Host-vonix-affiliate-member";

function key(): Buffer | null {
  const secret = env("AFFILIATE_ADMIN_SESSION_SECRET");
  if (secret.length < 32) return null;
  return createHmac("sha256", secret).update("vonix-affiliate-member-session:v1").digest();
}
const validEmail = (email: string) =>
  /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(email) &&
  email.length <= 180 &&
  email === email.toLowerCase();

export function createAffiliateMemberSession(identity: AffiliateMemberIdentity): boolean {
  const signingKey = key();
  if (!signingKey || !validEmail(identity.email) || !role.includes(identity.role)) return false;
  const expires = Date.now() + MAX_AGE * 1000;
  const body = [
    "v1",
    Buffer.from(identity.email, "utf8").toString("base64url"),
    identity.role,
    String(expires),
    randomBytes(16).toString("base64url"),
  ].join(".");
  const signature = createHmac("sha256", signingKey).update(body).digest("base64url");
  setCookie(cookieName(), body + "." + signature, {
    httpOnly: true,
    secure: !isLoopback(),
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export function affiliateMemberSession(): AffiliateMemberIdentity | null {
  const signingKey = key();
  const token = getCookie(cookieName());
  if (!signingKey || !token || token.length > 460) return null;
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v1") return null;
  const [version, email64, memberRole, expiresRaw, nonce, signature] = parts;
  if (
    version !== "v1" ||
    !email64 ||
    !memberRole ||
    !role.includes(memberRole as AffiliateMemberRole) ||
    !/^\d{13}$/.test(expiresRaw || "") ||
    !/^[A-Za-z0-9_-]{22}$/.test(nonce || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature || "") ||
    Number(expiresRaw) <= Date.now()
  )
    return null;
  const signed = parts.slice(0, 5).join(".");
  const expected = createHmac("sha256", signingKey).update(signed).digest();
  const supplied = Buffer.from(signature!, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const email = Buffer.from(email64, "base64url").toString("utf8");
  return validEmail(email) ? { email, role: memberRole as AffiliateMemberRole } : null;
}

export function clearAffiliateMemberSession() {
  deleteCookie(cookieName(), {
    httpOnly: true,
    secure: !isLoopback(),
    sameSite: "strict",
    path: "/",
  });
}
