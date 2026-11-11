import { createHmac } from "node:crypto";
import { z } from "zod";
import { affiliateDatabaseConfig } from "./affiliate-database.server";
import { env } from "./env.server";
import { affiliateResendApiKey } from "./affiliate-resend-config.server";
import { VONIX_AFFILIATE_PUBLIC_KEY } from "./vonix-affiliate-auth";

const emailSchema = z.string().trim().toLowerCase().email().max(180);
export type AffiliateAuthEmailPurpose = "applicant" | "owner";

/** Log only fixed failure categories and HTTP status codes. Never log OTPs,
 * magic links, recipient addresses, provider response bodies or credentials. */
function auditAffiliateAuthMailFailure(phase: string, status?: number) {
  const safeStatus =
    status && Number.isInteger(status) && status >= 100 && status <= 599 ? String(status) : "none";
  console.warn(`[vonix-affiliate-auth-mail] ${phase} http=${safeStatus}`);
}

/**
 * Reduce a Resend error to a fixed diagnostic label. Never send the
 * upstream response body, recipient, sender, OTP or key to application logs.
 * Unknown payloads are intentionally reported without detail.
 */
async function classifyAffiliateResendError(response: Response): Promise<string> {
  if (response.status !== 400 && response.status !== 422) return "resend-api-http";
  try {
    const raw: unknown = await response.json();
    const parsed = z
      .object({ name: z.string().max(80).optional(), message: z.string().max(4000).optional() })
      .safeParse(raw);
    if (!parsed.success || parsed.data.name !== "validation_error") return "resend-api-http";
    const message = (parsed.data.message ?? "").toLowerCase();
    if (/api[ -]?key/.test(message) && /invalid|revoked|not valid|unauthorized/.test(message))
      return "resend-api-key-invalid";
    if (
      /(?:from|sender|remetente)/.test(message) &&
      /invalid|not valid|verified|required|domain/.test(message)
    )
      return "resend-api-sender-invalid";
    if (/domain/.test(message) && /unverified|not verified|not allowed|restricted/.test(message))
      return "resend-api-domain-invalid";
    return "resend-api-validation-error";
  } catch {
    return "resend-api-http";
  }
}

export function affiliateCustomAuthEmailReady(): boolean {
  const key = affiliateResendApiKey();
  const sender = env("AFFILIATE_FROM_EMAIL");
  return key.length >= 20 && sender.length >= 6 && sender.length <= 240;
}

/** Verifies that an identity was pre-authorized, without returning its existence. */
export async function affiliateEmailAuthorizedForPortal(
  email: string,
  purpose: AffiliateAuthEmailPurpose,
): Promise<boolean> {
  const parsed = emailSchema.safeParse(email);
  const db = affiliateDatabaseConfig();
  if (!parsed.success || !db) return false;
  const table =
    purpose === "applicant" ? "vonix_affiliate_applications" : "vonix_affiliate_admin_invites";
  const response = await fetch(
    db.url +
      "/rest/v1/" +
      table +
      "?select=email&email=eq." +
      encodeURIComponent(parsed.data) +
      "&limit=1",
    {
      method: "GET",
      headers: db.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) throw new Error("Private affiliation lookup failed.");
  const rows = z
    .array(z.object({ email: z.string().email() }))
    .max(1)
    .parse(await response.json());
  return rows.length === 1 && rows[0]!.email.toLowerCase() === parsed.data;
}

/**
 * Last-resort delivery fallback after recipient authorization and recipient cooldown.
 * This is NOT an alternate authentication system: the dedicated Supabase Auth
 * project still issues and validates the OTP. The managed provider may be rate
 * limited, so its success only means it accepted the request, not delivered it.
 * Do not log addresses, tokens, links, response bodies or key material.
 */
async function requestAffiliateSupabaseManagedOtp(
  email: string,
  redirectUrl: string,
  authUrl: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      authUrl + "/auth/v1/otp?redirect_to=" + encodeURIComponent(redirectUrl),
      {
        method: "POST",
        headers: {
          apikey: VONIX_AFFILIATE_PUBLIC_KEY,
          Authorization: "Bearer " + VONIX_AFFILIATE_PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, create_user: false }),
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      auditAffiliateAuthMailFailure("supabase-managed-fallback-http", response.status);
      return false;
    }
    console.info("[vonix-affiliate-auth-mail] supabase-managed-fallback-accepted");
    return true;
  } catch {
    auditAffiliateAuthMailFailure("supabase-managed-fallback-network");
    return false;
  }
}

/** Send a Supabase-generated OTP + magic link via the already-configured
 * Resend transactional provider, bypassing Supabase's development SMTP cap.
 *
 * Generated codes and links NEVER leave the server except in the recipient's
 * authenticated e-mail. Auth is still verified by Supabase; no manual flag
 * setting, forced email confirmation or password bypass takes place.
 */
export async function sendAffiliateAuthEmailWithResend(
  email: string,
  purpose: AffiliateAuthEmailPurpose,
): Promise<boolean> {
  const address = emailSchema.safeParse(email);
  const db = affiliateDatabaseConfig();
  if (!address.success || !db || !affiliateCustomAuthEmailReady()) return false;
  const fingerprint = affiliateAccessEmailFingerprint(address.data);
  if (!fingerprint) return false;
  // Atomic recipient cooldown: a bot cannot repeatedly invalidate another
  // applicant's OTP by rotating IP addresses or pressing resend.
  const quota = await fetch(db.url + "/rest/v1/rpc/vonix_affiliate_consume_auth_mail_cooldown", {
    method: "POST",
    headers: db.headers,
    body: JSON.stringify({ p_fingerprint: fingerprint }),
    redirect: "manual",
    signal: AbortSignal.timeout(4500),
  });
  if (!quota.ok) {
    auditAffiliateAuthMailFailure("recipient-cooldown-rpc-http", quota.status);
    return false;
  }
  if ((await quota.json()) !== true) return false;
  const redirectUrl =
    purpose === "owner"
      ? "https://vonixhair.com/acesso-equipe-afiliadas"
      : "https://vonixhair.com/acompanhar-inscricao";
  const generation = await fetch(db.url + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: db.headers,
    body: JSON.stringify({
      type: "magiclink",
      email: address.data,
      redirect_to: redirectUrl,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (!generation.ok) {
    auditAffiliateAuthMailFailure("supabase-generate-link-http", generation.status);
    return false;
  }
  const raw: unknown = await generation.json();
  const parsed = z
    .object({
      action_link: z.string().url().optional(),
      email_otp: z.string().optional(),
      properties: z
        .object({
          action_link: z.string().url().optional(),
          email_otp: z.string().optional(),
        })
        .optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    auditAffiliateAuthMailFailure("supabase-generate-link-invalid-payload");
    return false;
  }
  const link = parsed.data.action_link ?? parsed.data.properties?.action_link;
  const otp = parsed.data.email_otp ?? parsed.data.properties?.email_otp;
  if (!link) {
    auditAffiliateAuthMailFailure("supabase-generate-link-missing-link");
    return false;
  }
  const parsedLink = new URL(link);
  // Never send a generated token if any upstream response points away from
  // the dedicated Auth project, even if an unexpected response was HTTP 200.
  if (
    parsedLink.origin !== db.url ||
    parsedLink.pathname !== "/auth/v1/verify" ||
    parsedLink.protocol !== "https:"
  ) {
    auditAffiliateAuthMailFailure("supabase-generate-link-unexpected-origin");
    return false;
  }
  const safeOtp = otp && /^\d{6,8}$/.test(otp) ? otp : null;
  if (!safeOtp) {
    auditAffiliateAuthMailFailure("supabase-generate-link-no-numeric-otp");
    return false;
  }
  const subject =
    purpose === "owner"
      ? "Vonix Hair — confirme seu acesso à equipe"
      : "Vonix Hair — acompanhe sua candidatura";
  const text = [
    "Este acesso foi solicitado no site oficial Vonix Hair.",
    "",
    "Seu código de verificação: " + safeOtp,
    "",
    "Abra esta página oficial e DIGITE o código acima no formulário:",
    redirectUrl,
    "",
    "Este endereço não confirma o acesso automaticamente. Não reutilize links de convites anteriores: eles podem ter expirado ou já ter sido utilizados.",
    ...(purpose === "owner"
      ? ["Depois de confirmar o código, crie sua senha pessoal para entrar na gestão da equipe."]
      : ["Depois de confirmar o código, consulte o acompanhamento da candidatura."]),
    "",
    "Se você não solicitou este acesso, ignore esta mensagem.",
    "Não compartilhe códigos, links ou senhas.",
  ].join("\n");

  let accepted = false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + affiliateResendApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env("AFFILIATE_FROM_EMAIL"),
        to: [address.data],
        subject,
        text,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      auditAffiliateAuthMailFailure(await classifyAffiliateResendError(response), response.status);
    } else {
      const receipt: unknown = await response.json();
      accepted = z.object({ id: z.string().min(1).max(128) }).safeParse(receipt).success;
      if (!accepted) auditAffiliateAuthMailFailure("resend-api-invalid-receipt");
    }
  } catch {
    auditAffiliateAuthMailFailure("resend-api-network");
  }

  if (accepted) return true;
  // Do not bypass the recipient cooldown: the fallback runs only after the
  // same authorization, quota and Supabase OTP-generation gates above.
  // A managed Supabase e-mail is a temporary alternative while Resend is
  // rejected, NOT proof that the custom provider is configured correctly.
  return requestAffiliateSupabaseManagedOtp(address.data, redirectUrl, db.url);
}

/** Per-email HMAC identifier, with no plaintext email in throttle storage. */
export function affiliateAccessEmailFingerprint(email: string): string | null {
  const address = emailSchema.safeParse(email);
  const pepper = env("AFFILIATE_TRAFFIC_PEPPER");
  if (!address.success || pepper.length < 32) return null;
  return createHmac("sha256", pepper)
    .update("vonix-affiliate/access-email/v1:")
    .update(address.data)
    .digest("hex");
}
