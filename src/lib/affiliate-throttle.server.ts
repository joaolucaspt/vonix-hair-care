import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "./env.server";
import { affiliateDatabaseConfig } from "./affiliate-database.server";

export type AffiliateRateScope = "submit" | "admin";

export function affiliateIpDigest(
  ip: string | null | undefined,
  scope: AffiliateRateScope,
  pepper: string,
): string | null {
  if (!ip || !isIP(ip.trim()) || pepper.length < 32) return null;
  return createHmac("sha256", pepper)
    .update("vonix-affiliate/" + scope + "/" + ip.trim())
    .digest("hex");
}

/** Only trust headers set/overwritten by the reverse proxy, never an arbitrary client-selected IP. */
function verifiedAffiliateClientIpHeader(): string {
  const explicit = env("AFFILIATE_TRUSTED_IP_HEADER");
  if (explicit) {
    return ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"].includes(explicit) ? explicit : "";
  }
  // Lovable runs behind Cloudflare: CF-RAY and CF-Connecting-IP are supplied
  // by the edge, not by a user-controlled forwarding chain. Without these
  // platform signals, fail closed rather than trust spoofable headers.
  try {
    const ray = getRequestHeader("cf-ray")?.trim() ?? "";
    const ip = getRequestHeader("cf-connecting-ip")?.trim() ?? "";
    return ray && isIP(ip) !== 0 ? "cf-connecting-ip" : "";
  } catch {
    return "";
  }
}

export function affiliateTrustedIpHeaderValid(): boolean {
  return Boolean(verifiedAffiliateClientIpHeader());
}

/**
 * Explicit edge configuration is mandatory: any client can forge forwarded headers
 * unless the selected reverse proxy strips and overwrites them at ingress.
 */
function trustedClientIp(): string | undefined {
  const trusted = verifiedAffiliateClientIpHeader();
  if (trusted === "cf-connecting-ip") return getRequestHeader("cf-connecting-ip")?.trim();
  if (trusted === "x-real-ip") return getRequestHeader("x-real-ip")?.trim();
  if (trusted === "x-forwarded-for")
    return getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
  return undefined;
}

/** Fail closed when IP forwarding, secret or database protection is unavailable. */
async function affiliateRateRequest(
  scope: AffiliateRateScope,
  rpc: "consume_rate_limit" | "rate_limit_allowed",
): Promise<boolean> {
  const digest = affiliateIpDigest(trustedClientIp(), scope, env("AFFILIATE_TRAFFIC_PEPPER"));
  const config = affiliateDatabaseConfig();
  if (!digest || !config) return false;
  try {
    const response = await fetch(config.url + "/rest/v1/rpc/vonix_affiliate_" + rpc, {
      method: "POST",
      headers: config.headers,
      redirect: "manual",
      body: JSON.stringify({ p_scope: scope, p_fingerprint: digest }),
      signal: AbortSignal.timeout(4500),
    });
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
}

export const consumeAffiliateRateLimit = (scope: AffiliateRateScope) =>
  affiliateRateRequest(scope, "consume_rate_limit");
export const affiliateRateLimitAllowed = (scope: AffiliateRateScope) =>
  affiliateRateRequest(scope, "rate_limit_allowed");
