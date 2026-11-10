import { z } from "zod";
import { affiliateAdminSameOrigin } from "./affiliate-admin-session.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import { createAffiliateMemberSession } from "./affiliate-member-session.server";
import { VONIX_AFFILIATE_AUTH_URL, VONIX_AFFILIATE_PUBLIC_KEY } from "./vonix-affiliate-auth";

const INVALID =
  "Acesso não autorizado. Verifique o e-mail, a senha pessoal e sua permissão de equipe.";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(180),
  password: z.string().min(12).max(128),
});

const tokenSchema = z.object({
  access_token: z.string().min(100).max(4096),
  user: z.object({
    email: z.string().email().max(180),
    email_confirmed_at: z.string().nullable().optional(),
  }),
});

const teamSchema = z
  .array(
    z.object({
      email: z.string().email().max(180),
      role: z.enum(["reviewer", "owner"]),
      password_set_at: z.string().datetime({ offset: true }).nullable(),
    }),
  )
  .max(1);

/**
 * Require a fresh password grant on the server. Exchanging an arbitrary
 * Supabase access token is NOT enough: OTP links must never bypass the
 * mandatory admin password after first-time account activation.
 */
export async function loginAffiliateTeamWithPassword(email: string, password: string) {
  if (!affiliateAdminSameOrigin()) return { ok: false as const, reason: INVALID };
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) return { ok: false as const, reason: INVALID };

  try {
    if (!(await affiliateRateLimitAllowed("admin")))
      return { ok: false as const, reason: "Limite de autenticações alcançado." };

    const response = await fetch(VONIX_AFFILIATE_AUTH_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        apikey: VONIX_AFFILIATE_PUBLIC_KEY,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(parsed.data),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Password grant rejected.");
    const auth = tokenSchema.parse(await response.json());
    const verifiedEmail = auth.user.email.toLowerCase();
    if (!auth.user.email_confirmed_at || verifiedEmail !== parsed.data.email)
      throw new Error("Email not verified.");

    const membership = await fetch(
      VONIX_AFFILIATE_AUTH_URL +
        "/rest/v1/vonix_affiliate_admin_invites?select=email,role,password_set_at&email=eq." +
        encodeURIComponent(verifiedEmail) +
        "&limit=1",
      {
        headers: {
          apikey: VONIX_AFFILIATE_PUBLIC_KEY,
          Authorization: "Bearer " + auth.access_token,
          "Cache-Control": "no-store",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!membership.ok) throw new Error("Role query unavailable.");
    const members = teamSchema.parse(await membership.json());
    const member = members[0];
    if (!member || member.email !== verifiedEmail || !member.password_set_at)
      throw new Error("Invitation not activated.");
    if (!createAffiliateMemberSession({ email: verifiedEmail, role: member.role }))
      throw new Error("Secure session configuration unavailable.");
    return { ok: true as const };
  } catch {
    try {
      await consumeAffiliateRateLimit("admin");
    } catch {
      // Rate-limit storage errors must not disclose credential validity.
    }
    return { ok: false as const, reason: INVALID };
  }
}
