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
  const checkoutKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const expectedRef = env("AFFILIATE_SUPABASE_PROJECT_REF");
  // An explicit server-side project pin is mandatory in every environment.
  // Without it, a valid-looking checkout URL could receive private applicant data.
  if (
    !rawUrl ||
    key.length < 16 ||
    (checkoutKey.length > 0 && key === checkoutKey) ||
    !/^[a-z0-9]{20}$/.test(expectedRef)
  )
    return null;

  try {
    const url = new URL(rawUrl);
    // A separately named key is not sufficient: never reuse the checkout DB.
    const checkoutUrl = env("SUPABASE_URL");
    if (checkoutUrl) {
      try {
        if (new URL(checkoutUrl).origin === url.origin) return null;
      } catch {
        // Invalid checkout configuration does not authorize an affiliate fallback.
      }
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.hostname !== expectedRef + ".supabase.co" ||
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
