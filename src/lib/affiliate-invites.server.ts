import { affiliateDatabaseConfig } from "./affiliate-database.server";

/**
 * Provision an applicant login ONLY after the application's durable insert
 * (or a verified duplicate-email record) has succeeded.
 *
 * Uses the private dedicated service role on the server; the publishable key
 * cannot invite users. Failure is non-fatal to the already saved application.
 */
export async function invitePersistedAffiliateApplicant(email: string): Promise<boolean> {
  const db = affiliateDatabaseConfig();
  if (!db || !/^[^\\s@]{1,64}@[^\\s@]{1,190}$/.test(email) || email.length > 180) return false;
  try {
    const response = await fetch(
      db.url +
        "/auth/v1/invite?redirect_to=" +
        encodeURIComponent("https://vonixhair.com/acompanhar-inscricao"),
      {
        method: "POST",
        headers: db.headers,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        redirect: "error",
        signal: AbortSignal.timeout(9000),
      },
    );
    // Existing identity is acceptable; that e-mail can request an OTP from
    // the applicant portal. Other errors must not be treated as delivery.
    return response.ok;
  } catch {
    return false;
  }
}
