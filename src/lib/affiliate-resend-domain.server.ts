import { z } from "zod";
import { affiliateResendApiKey } from "./affiliate-resend-config.server";
import { env } from "./env.server";

/** Sending access keys can send mail but cannot read the domain catalog.
 * This non-sending, server-only probe does not prove inbox delivery.
 */
const domainResponse = z.object({
  data: z
    .array(
      z.object({
        name: z.string().min(3).max(253),
        status: z.enum([
          "verified",
          "pending",
          "failed",
          "not_started",
          "partially_verified",
          "partially_failed",
        ]),
      }),
    )
    .max(100),
  has_more: z.boolean().optional(),
});
export type AffiliateSenderDiagnosis =
  | {
      status:
        | "verified"
        | "pending"
        | "failed"
        | "not_started"
        | "partially_verified"
        | "partially_failed";
      domain: string;
    }
  | {
      status:
        | "sender-invalid"
        | "not-configured"
        | "key-unauthorized"
        | "read-restricted"
        | "rate-limited"
        | "provider-unavailable"
        | "not-verifiable";
    };

export function affiliateResendSenderDomain(raw: string): string | null {
  const sender = raw.trim();
  const angle = /^.{1,120}\s<([^<>]+)>$/.exec(sender);
  const address = angle ? angle[1] : sender;
  if (!address || !z.string().email().safeParse(address).success) return null;
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain) ? domain : null;
}

/** No email is sent; this only queries the authenticated Resend domain catalog. */
export async function inspectAffiliateResendSenderDomain(): Promise<AffiliateSenderDiagnosis> {
  const domain = affiliateResendSenderDomain(env("AFFILIATE_FROM_EMAIL"));
  if (!domain) return { status: "sender-invalid" };
  const key = affiliateResendApiKey();
  if (!key || key.length < 20) return { status: "not-configured" };
  try {
    const response = await fetch("https://api.resend.com/domains?limit=100", {
      method: "GET",
      headers: { Authorization: "Bearer " + key },
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
    });
    if (response.status === 401) return { status: "key-unauthorized" };
    if (response.status === 403) return { status: "read-restricted" };
    if (response.status === 429) return { status: "rate-limited" };
    if (!response.ok) return { status: "provider-unavailable" };

    const parsed = domainResponse.safeParse(await response.json());
    if (!parsed.success) return { status: "not-verifiable" };
    const found = parsed.data.data.find((candidate) => candidate.name.toLowerCase() === domain);
    if (!found) return { status: "not-verifiable" };
    return { status: found.status, domain };
  } catch {
    // Never log upstream bodies or the bearer key.
    return { status: "provider-unavailable" };
  }
}
