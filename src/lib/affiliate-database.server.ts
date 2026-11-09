import { env } from "./env.server";

/**
 * Affiliate applicant records must be isolated from the storefront checkout DB.
 * Never fall back to SUPABASE_URL or the store's service-role credentials.
 * This code runs exclusively in the backend (never import it into client UI).
 */
export function affiliateDatabaseConfig(): {
  url: string;
  headers: Record<string, string>;
} | null {
  const rawUrl = env("AFFILIATE_SUPABASE_URL");
  const key = env("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY");
  if (!rawUrl || key.length < 16) return null;

  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      (url.pathname !== "" && url.pathname !== "/")
    )
      return null;
    return {
      url: url.origin,
      headers: {
        apikey: key,
        authorization: "Bearer " + key,
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    };
  } catch {
    return null;
  }
}

export function requireAffiliateDatabaseConfig() {
  const config = affiliateDatabaseConfig();
  if (!config) throw new Error("Banco dedicado de candidaturas não configurado.");
  return config;
}
