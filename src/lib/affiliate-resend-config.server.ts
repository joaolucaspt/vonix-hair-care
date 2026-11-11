import { env } from "./env.server";

/** Affiliate-only credential rotation without changing other Lovable integrations.
 * Keep the prior key as a fallback for releases where the new scoped secret
 * has not yet been provisioned. Never print either credential.
 */
export function affiliateResendApiKey(): string {
  return env("AFFILIATE_RESEND_API_KEY") || env("RESEND_API_KEY");
}
