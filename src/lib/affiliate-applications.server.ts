import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env.server";
import {
  affiliateApplicationSchema,
  type AffiliateApplicationInput,
  type AffiliateApplicationRecord,
  type AffiliateStatus,
} from "./affiliate-application";
import { affiliateDecisionEmail } from "./affiliate-email";
import { affiliateTrustedIpHeaderValid } from "./affiliate-throttle.server";

function supabase() {
  const dedicatedUrl = env("AFFILIATE_SUPABASE_URL");
  const dedicatedKey = env("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY");
  if (Boolean(dedicatedUrl) !== Boolean(dedicatedKey)) {
    throw new Error("Banco dedicado de afiliadas parcialmente configurado.");
  }
  const url = dedicatedUrl || env("SUPABASE_URL");
  const key = dedicatedKey || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Banco de inscrições não configurado.");
  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  };
}

/**
 * Publishing the source must never advertise an open signup before infrastructure
 * has been configured and independently tested by an operator.
 */
export function affiliateRecruitmentOpen(): boolean {
  if (env("AFFILIATE_RECRUITMENT_OPEN") !== "true") return false;
  const dedicatedUrl = env("AFFILIATE_SUPABASE_URL");
  const dedicatedKey = env("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY");
  if (Boolean(dedicatedUrl) !== Boolean(dedicatedKey)) return false;
  const url = dedicatedUrl || env("SUPABASE_URL");
  const key = dedicatedKey || env("SUPABASE_SERVICE_ROLE_KEY");
  const otp = env("AFFILIATE_ADMIN_TOTP_SECRET").replace(/\s/g, "");
  return Boolean(
    url &&
    key &&
    env("AFFILIATE_TRAFFIC_PEPPER").length >= 32 &&
    affiliateTrustedIpHeaderValid() &&
    env("AFFILIATE_ADMIN_PASSWORD").length >= 16 &&
    env("AFFILIATE_ADMIN_SESSION_SECRET").length >= 32 &&
    (process.env["NODE_ENV"] !== "production" || /^[A-Z2-7]{32,128}$/i.test(otp)) &&
    env("AFFILIATE_WORKER_SECRET").length >= 24 &&
    env("RESEND_API_KEY") &&
    env("AFFILIATE_FROM_EMAIL"),
  );
}

export function secureEqual(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const a = createHash("sha256").update(actual).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function affiliateAdminAuthorized(password: string) {
  const configured = env("AFFILIATE_ADMIN_PASSWORD");
  return configured.length >= 16 && secureEqual(password, configured);
}

async function requestSupabase(route: string, init?: RequestInit) {
  const config = supabase();
  const response = await fetch(config.url + "/rest/v1/" + route, {
    ...init,
    headers: { ...config.headers, ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  return response;
}

function normalizedProfile(raw: string) {
  const parsed = new URL(raw);
  return (
    "https://" +
    parsed.hostname.toLowerCase().replace(/^www\./, "") +
    parsed.pathname.replace(/\/$/, "").toLowerCase()
  );
}

export async function createAffiliateApplication(raw: AffiliateApplicationInput) {
  const data = affiliateApplicationSchema.parse(raw);
  if (data.website) return { ok: true as const }; // blind honeypot
  const response = await requestSupabase("vonix_affiliate_applications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      full_name: data.fullName,
      age: data.age,
      city: data.city,
      state: data.state,
      hair_type: data.hairType,
      email: data.email,
      instagram_url: normalizedProfile(data.instagram),
      tiktok_url: normalizedProfile(data.tiktok),
      motivation: data.motivation,
      consent_at: new Date().toISOString(),
    }),
  });
  // A duplicate e-mail/profile gets the same public response to prevent account enumeration.
  if (response.status === 409) return { ok: true as const };
  if (!response.ok) throw new Error("Falha ao salvar inscrição: HTTP " + response.status);
  return { ok: true as const };
}

export type AffiliateMailCounters = Record<
  "pendente" | "processando" | "enviado" | "falhou" | "incerto",
  number
>;

export interface AffiliateList {
  applications: AffiliateApplicationRecord[];
  total: number;
  stats: Record<AffiliateStatus, number>;
  mailStats: AffiliateMailCounters;
}

const validStatus = z.enum(["pendente", "aprovada", "recusada"]);

export async function listAffiliateApplications(input: {
  status: AffiliateStatus;
  page: number;
  search?: string | undefined;
}): Promise<AffiliateList> {
  const status = validStatus.parse(input.status);
  const page = z.number().int().min(0).max(50000).parse(input.page);
  const q = z
    .string()
    .trim()
    .max(70)
    .parse(input.search ?? "");
  const [rows, totals] = await Promise.all([
    requestSupabase("rpc/vonix_affiliate_search", {
      method: "POST",
      body: JSON.stringify({ p_status: status, p_query: q, p_offset: page * 40, p_limit: 40 }),
    }),
    requestSupabase("rpc/vonix_affiliate_stats", { method: "POST", body: "{}" }),
  ]);
  if (!rows.ok || !totals.ok) throw new Error("Consulta de inscrições indisponível.");
  const result = (await rows.json()) as { total?: unknown; applications?: unknown };
  const raw = (await totals.json()) as Partial<Record<AffiliateStatus, number>> | null;
  if (
    !Array.isArray(result?.applications) ||
    typeof result?.total !== "number" ||
    result.total < 0
  ) {
    throw new Error("Formato inválido da consulta de inscrições.");
  }
  return {
    applications: result.applications as AffiliateApplicationRecord[],
    total: result.total,
    stats: {
      pendente: Number(raw?.pendente ?? 0),
      aprovada: Number(raw?.aprovada ?? 0),
      recusada: Number(raw?.recusada ?? 0),
    },
    mailStats: {
      pendente: Number((raw as Record<string, unknown> | null)?.["email_pendente"] ?? 0),
      processando: Number((raw as Record<string, unknown> | null)?.["email_processando"] ?? 0),
      enviado: Number((raw as Record<string, unknown> | null)?.["email_enviado"] ?? 0),
      falhou: Number((raw as Record<string, unknown> | null)?.["email_falhou"] ?? 0),
      incerto: Number((raw as Record<string, unknown> | null)?.["email_incerto"] ?? 0),
    },
  };
}

export async function decideAffiliateApplication(id: string, decision: "aprovada" | "recusada") {
  const response = await requestSupabase("rpc/vonix_affiliate_decide", {
    method: "POST",
    body: JSON.stringify({
      p_id: z.string().uuid().parse(id),
      p_decision: z.enum(["aprovada", "recusada"]).parse(decision),
    }),
  });
  if (!response.ok) throw new Error("Não foi possível registrar a decisão.");
  return (await response.json()) === true;
}

type ClaimedMail = {
  mail_id: string;
  application_id: string;
  recipient: string;
  decision: "aprovada" | "recusada";
  attempt: number;
};

async function claimAffiliateMail(id?: string): Promise<ClaimedMail | null> {
  const response = await requestSupabase("rpc/vonix_affiliate_claim_mail", {
    method: "POST",
    body: JSON.stringify({ p_application_id: id ?? null }),
  });
  if (!response.ok) throw new Error("Não foi possível reservar notificação.");
  const results = (await response.json()) as ClaimedMail[];
  return results[0] ?? null;
}

async function finishAffiliateMail(
  mail: ClaimedMail,
  success: boolean,
  providerId: string | null,
  unknown = false,
  permanent = false,
) {
  const response = await requestSupabase("rpc/vonix_affiliate_finish_mail", {
    method: "POST",
    body: JSON.stringify({
      p_mail_id: mail.mail_id,
      p_attempt: mail.attempt,
      p_success: success,
      p_provider_id: providerId,
      p_unknown: unknown,
      p_permanent: permanent,
    }),
  });
  if (!response.ok) throw new Error("Falha ao registrar resultado de e-mail.");
  return (await response.json()) === true;
}

/** Each email is one DB outbox row; Resend de-duplicates retries for 24h. */
export async function processAffiliateEmails(limit = 5, applicationId?: string) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("AFFILIATE_FROM_EMAIL");
  if (!apiKey || !from) return { sent: 0, failed: 0, configured: false };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < Math.min(Math.max(limit, 0), 10); i++) {
    const mail = await claimAffiliateMail(applicationId);
    if (!mail) break;
    const message = affiliateDecisionEmail(mail.decision);
    let successful = false;
    let providerId: string | null = null;
    let unknown = false;
    let permanent = false;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: "Bearer " + apiKey,
          "content-type": "application/json",
          "Idempotency-Key": "vonix-afiliada-" + mail.mail_id,
        },
        body: JSON.stringify({
          from,
          to: [mail.recipient],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = (await response.json()) as { id?: unknown };
        // HTTP 200 without a provider receipt is ambiguous; don't mark sent.
        if (typeof data.id === "string" && data.id.length > 0) {
          providerId = data.id;
          successful = true;
        } else {
          unknown = true;
        }
      } else {
        // 409 can mean a concurrent idempotent request or conflicting content.
        unknown = response.status === 409 || response.status >= 500;
        permanent = [400, 401, 403, 404, 409, 422].includes(response.status);
      }
    } catch {
      // A timeout may happen AFTER the provider accepted the message.
      unknown = true;
    }
    const recorded = await finishAffiliateMail(mail, successful, providerId, unknown, permanent);
    if (!recorded) throw new Error("Email claim changed before status could be persisted.");
    if (successful) sent++;
    else failed++;
    // Avoid reclaiming the same candidate in the same run after a transient failure.
    if (!successful) break;
  }
  return { sent, failed, configured: true };
}
