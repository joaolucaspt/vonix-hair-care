import { z } from "zod";
import { inspectAffiliateResendSenderDomain } from "./affiliate-resend-domain.server";
import { affiliateAdminSameOrigin } from "./affiliate-admin-session.server";
import { affiliateDatabaseConfig } from "./affiliate-database.server";
import {
  affiliateAccessEmailFingerprint,
  affiliateCustomAuthEmailReady,
  sendAffiliateAuthEmailWithResend,
  sendAffiliateManagedAuthOtp,
} from "./affiliate-auth-delivery.server";
import { affiliateMemberSession } from "./affiliate-member-session.server";
import { affiliateRateLimitAllowed } from "./affiliate-throttle.server";

/**
 * Emergency owner-mediated enrollment when transactional e-mail is unavailable.
 * The established Supabase Auth project still creates/verifies single-use links,
 * and individual passwords remain required before opening applicant data.
 *
 * NEVER log or persist generated links. They are bearer credentials.
 */
const address = z.string().trim().toLowerCase().email().max(180);
const ownerRow = z.object({
  email: address,
  role: z.literal("owner"),
  password_set_at: z.string().datetime({ offset: true }).nullable(),
});
const pendingRow = z.object({
  email: address,
  role: z.literal("owner"),
  password_set_at: z.null(),
});
const grant = z.object({
  action_link: z.string().url().optional(),
  hashed_token: z.string().min(32).max(256).optional(),
  properties: z
    .object({
      action_link: z.string().url().optional(),
      hashed_token: z.string().min(32).max(256).optional(),
    })
    .optional(),
});

type Database = NonNullable<ReturnType<typeof affiliateDatabaseConfig>>;
export type PendingAffiliateOwner = { email: string };

async function authorizedActivatedOwner(db: Database): Promise<boolean> {
  if (!affiliateAdminSameOrigin()) return false;
  const identity = affiliateMemberSession();
  if (!identity || identity.role !== "owner") return false;
  try {
    if (!(await affiliateRateLimitAllowed("admin"))) return false;
    const url =
      db.url +
      "/rest/v1/vonix_affiliate_admin_invites?select=email,role,password_set_at&email=eq." +
      encodeURIComponent(identity.email) +
      "&limit=1";
    const response = await fetch(url, {
      method: "GET",
      headers: db.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return false;
    const owners = z
      .array(ownerRow)
      .max(1)
      .parse(await response.json());
    return (
      owners.length === 1 && owners[0]!.email === identity.email && !!owners[0]!.password_set_at
    );
  } catch {
    return false;
  }
}

/** Stronger authorization for irreversible actions. A signed member cookie
 * alone is insufficient after a team owner's role or activation is revoked. */
export async function affiliateActivatedOwnerStillAuthorized(): Promise<boolean> {
  const db = affiliateDatabaseConfig();
  return db ? authorizedActivatedOwner(db) : false;
}

async function fetchPendingOwners(db: Database): Promise<PendingAffiliateOwner[] | null> {
  try {
    const response = await fetch(
      db.url +
        "/rest/v1/vonix_affiliate_admin_invites?select=email,role,password_set_at" +
        "&role=eq.owner&password_set_at=is.null&order=email.asc&limit=12",
      {
        method: "GET",
        headers: db.headers,
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return null;
    const pending = z
      .array(pendingRow)
      .max(12)
      .parse(await response.json());
    return pending.map((row) => ({ email: row.email }));
  } catch {
    return null;
  }
}

/** Owner-only, read-only provider check. No OTPs or emails are generated. */
export async function diagnoseAffiliateOwnerSender() {
  const db = affiliateDatabaseConfig();
  if (!db || !(await authorizedActivatedOwner(db))) return { ok: false as const };
  const diagnosis = await inspectAffiliateResendSenderDomain();
  return { ok: true as const, diagnosis };
}

/** Sensitive responses from these functions must always have Cache-Control: no-store. */
export async function listPendingAffiliateOwnerActivations() {
  const db = affiliateDatabaseConfig();
  if (!db || !(await authorizedActivatedOwner(db))) {
    return { ok: false as const, owners: [] as PendingAffiliateOwner[] };
  }
  const owners = await fetchPendingOwners(db);
  // Only an authenticated, active owner can learn that the protected query failed.
  // A forbidden caller still receives the indistinguishable, empty denied response.
  return owners
    ? { ok: true as const, owners }
    : { ok: false as const, owners: [], reason: "temporarily-unavailable" as const };
}

/**
 * Activated-owner-only resend to a pending, already invited owner. The
 * corporate mail contains an optional one-use confirmation link and OTP.
 * Never return the token or a magic link to the browser.
 */
export async function sendPendingAffiliateOwnerActivationEmail(email: string) {
  const db = affiliateDatabaseConfig();
  const parsed = address.safeParse(email);
  const denied = { ok: false as const, reason: "Acesso não autorizado ou conta não elegível." };
  if (!db || !parsed.success) return denied;
  if (!(await authorizedActivatedOwner(db))) return denied;
  const pending = await fetchPendingOwners(db);
  if (!pending?.some((row) => row.email === parsed.data)) return denied;
  try {
    // A preauthorized pending owner can request managed Supabase OTP when
    // the branded Resend sender is unconfigured, without public account creation.
    const accepted = affiliateCustomAuthEmailReady()
      ? await sendAffiliateAuthEmailWithResend(parsed.data, "owner")
      : await sendAffiliateManagedAuthOtp(parsed.data, "owner");
    if (!accepted)
      return {
        ok: false as const,
        reason:
          "O provedor não confirmou o envio. Aguarde o intervalo de segurança antes de tentar novamente.",
      };
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "Não foi possível solicitar o convite por e-mail." };
  }
}

/**
 * Generates a Supabase Auth single-use link for an already-invited, not-yet-
 * activated owner. Does not send messages or modify activation flags. The
 * authenticated owner copies the link and delivers it privately to its owner.
 * Never expose the link to reviewers, a public endpoint, logs or analytics.
 */
export async function generatePendingAffiliateOwnerActivationLink(email: string) {
  const db = affiliateDatabaseConfig();
  const parsed = address.safeParse(email);
  const denied = {
    ok: false as const,
    reason: "Acesso indisponível. Confira sua permissão e tente novamente.",
  };
  if (!db || !parsed.success || !(await authorizedActivatedOwner(db))) return denied;

  const pending = await fetchPendingOwners(db);
  if (!pending || !pending.some((row) => row.email === parsed.data)) return denied;

  const fingerprint = affiliateAccessEmailFingerprint(parsed.data);
  if (!fingerprint) return denied;
  try {
    // Durable recipient throttle also protects still-valid earlier links.
    const quota = await fetch(db.url + "/rest/v1/rpc/vonix_affiliate_consume_auth_mail_cooldown", {
      method: "POST",
      headers: db.headers,
      body: JSON.stringify({ p_fingerprint: fingerprint }),
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (!quota.ok) return denied;
    if ((await quota.json()) !== true) {
      return {
        ok: false as const,
        reason: "Aguarde o intervalo de segurança antes de gerar outro link para esta conta.",
      };
    }

    const destination = "https://vonixhair.com/acesso-equipe-afiliadas";
    const response = await fetch(db.url + "/auth/v1/admin/generate_link", {
      method: "POST",
      headers: db.headers,
      body: JSON.stringify({
        type: "magiclink",
        email: parsed.data,
        redirect_to: destination,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return denied;
    const payload = grant.safeParse(await response.json());
    if (!payload.success) return denied;
    const actionLink = payload.data.properties?.action_link ?? payload.data.action_link;
    if (!actionLink) return denied;
    const url = new URL(actionLink);
    if (
      url.origin !== db.url ||
      url.protocol !== "https:" ||
      url.pathname !== "/auth/v1/verify" ||
      url.searchParams.get("type") !== "magiclink" ||
      (url.searchParams.get("token") ?? "").length < 12 ||
      url.searchParams.get("redirect_to") !== destination ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return denied;
    }
    const tokenHash = payload.data.properties?.hashed_token ?? payload.data.hashed_token;
    if (!tokenHash || !/^[A-Za-z0-9_-]{32,256}$/.test(tokenHash)) return denied;
    // Fragment never reaches servers or link preview crawlers. The recipient
    // must explicitly click "Confirmar ativação" in our app to redeem the
    // one-time hash via POST /auth/v1/verify.
    const previewSafeLink = destination + "#vonix_invite=" + encodeURIComponent(tokenHash);
    return { ok: true as const, link: previewSafeLink, recipient: parsed.data };
  } catch {
    return denied;
  }
}
