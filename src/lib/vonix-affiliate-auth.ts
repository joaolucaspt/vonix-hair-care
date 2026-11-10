import { createClient } from "@supabase/supabase-js";
import { affiliateLinkRecoveryReason } from "./affiliate-auth-recovery";

// Public URL and publishable key, NOT a service role or database credential.
// This client can read only the verified applicant's status under PostgreSQL RLS.
export const VONIX_AFFILIATE_AUTH_URL = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
export const VONIX_AFFILIATE_PUBLIC_KEY = "sb_publishable_icOIi_TVKmrRu_n454Nkow_CIboGlZ8";

// Capture only a fixed recovery category before Supabase Auth can consume a
// failed verification fragment during client initialization. No token or URL
// is stored or exposed.
export const affiliateAuthInitialLinkRecoveryReason =
  typeof window === "undefined" ? null : affiliateLinkRecoveryReason(window.location.href);

export const vonixAffiliateAuth = createClient(
  VONIX_AFFILIATE_AUTH_URL,
  VONIX_AFFILIATE_PUBLIC_KEY,
  {
    auth: {
      storageKey: "vonix-affiliate-status-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Supabase Admin invite/generate_link verification redirects with an
      // implicit #access_token session. PKCE rejects that callback without
      // the browser-local code verifier and silently returns to e-mail entry.
      flowType: "implicit",
    },
  },
);

export function affiliateStatusRedirectUrl() {
  // Redirect URL must be allowlisted in Supabase Auth → URL Configuration.
  return typeof window === "undefined"
    ? "https://vonixhair.com/acompanhar-inscricao"
    : window.location.origin + "/acompanhar-inscricao";
}
