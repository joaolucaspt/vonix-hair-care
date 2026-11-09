import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "./env.server";

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
export function affiliateTrustedIpHeaderValid(): boolean {
  return ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"].includes(
    env("AFFILIATE_TRUSTED_IP_HEADER"),
  );
}

/**
 * Explicit edge configuration is mandatory: any client can forge forwarded headers
 * unless the selected reverse proxy strips and overwrites them at ingress.
 */
function trustedClientIp(): string | undefined {
  const trusted = env("AFFILIATE_TRUSTED_IP_HEADER");
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
  const dedicatedUrl = env("AFFILIATE_SUPABASE_URL");
  const dedicatedKey = env("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY");
  if (Boolean(dedicatedUrl) !== Boolean(dedicatedKey)) return false;
  const url = dedicatedUrl || env("SUPABASE_URL");
  const key = dedicatedKey || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!digest || !url || !key) return false;
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/vonix_affiliate_" + rpc, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: "Bearer " + key,
        "content-type": "application/json",
      },
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
