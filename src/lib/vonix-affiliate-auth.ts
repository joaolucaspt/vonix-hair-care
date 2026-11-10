import { createClient } from "@supabase/supabase-js";

// Public URL and publishable key, NOT a service role or database credential.
// This client can read only the verified applicant's status under PostgreSQL RLS.
export const VONIX_AFFILIATE_AUTH_URL = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
export const VONIX_AFFILIATE_PUBLIC_KEY = "sb_publishable_icOIi_TVKmrRu_n454Nkow_CIboGlZ8";

export const vonixAffiliateAuth = createClient(
  VONIX_AFFILIATE_AUTH_URL,
  VONIX_AFFILIATE_PUBLIC_KEY,
  {
    auth: {
      storageKey: "vonix-affiliate-status-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

export function affiliateStatusRedirectUrl() {
  // Redirect URL must be allowlisted in Supabase Auth → URL Configuration.
  return typeof window === "undefined"
    ? "https://vonixhair.com/acompanhar-inscricao"
    : window.location.origin + "/acompanhar-inscricao";
}
