import { z } from "zod";
import { affiliateDatabaseConfig } from "./affiliate-database.server";

const invitedEmailSchema = z.string().email().max(180);

/**
 * Provision an applicant login ONLY after the application's durable insert
 * (or a verified duplicate-email record) has succeeded.
 *
 * Uses the private dedicated service role on the server; the publishable key
 * cannot invite users. Failure is non-fatal to the already saved application.
 */
export async function invitePersistedAffiliateApplicant(email: string): Promise<boolean> {
  const db = affiliateDatabaseConfig();
  // Avoid the old handwritten regex: it rejected valid emails containing "s".
  // Reject all whitespace and malformed addresses before contacting Supabase.
  const validated = invitedEmailSchema.safeParse(email);
  if (!db || !validated.success) return false;
  try {
    const response = await fetch(
      db.url +
        "/auth/v1/invite?redirect_to=" +
        encodeURIComponent("https://vonixhair.com/acompanhar-inscricao"),
      {
        method: "POST",
        headers: db.headers,
        body: JSON.stringify({ email: validated.data.toLowerCase() }),
        redirect: "manual",
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
