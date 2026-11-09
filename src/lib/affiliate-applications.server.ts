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

function supabase() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
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
  return parsed.origin.toLowerCase() + parsed.pathname.replace(/\/$/, "").toLowerCase();
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
  if (response.status === 409)
    return { ok: false as const, reason: "Esta inscrição já foi recebida." };
  if (!response.ok) throw new Error("Falha ao salvar inscrição: HTTP " + response.status);
  return { ok: true as const };
}

export interface AffiliateList {
  applications: AffiliateApplicationRecord[];
  total: number;
  stats: Record<AffiliateStatus, number>;
}

const validStatus = z.enum(["pendente", "aprovada", "recusada"]);

export async function listAffiliateApplications(input: {
  status: AffiliateStatus;
  page: number;
  search?: string | undefined;
}): Promise<AffiliateList> {
  const status = validStatus.parse(input.status);
  const page = z.number().int().min(0).max(50000).parse(input.page);
  const q = (input.search ?? "")
    .trim()
    .replace(/[%_*(),.]/g, "")
    .slice(0, 70);
  const query = new URLSearchParams({
    select:
      "id,full_name,age,city,state,hair_type,email,instagram_url,tiktok_url,motivation,status,created_at,reviewed_at,vonix_affiliate_mail_outbox(status,sent_at)",
    status: "eq." + status,
    order: "created_at.desc,id.desc",
    limit: "40",
    offset: String(page * 40),
  });
  if (q.length > 0) query.set("or", "(full_name.ilike.*" + q + "*,email.ilike.*" + q + "*)");
  const [rows, totals] = await Promise.all([
    requestSupabase("vonix_affiliate_applications?" + query.toString(), {
      headers: { Prefer: "count=exact" },
    }),
    requestSupabase("rpc/vonix_affiliate_stats", { method: "POST", body: "{}" }),
  ]);
  if (!rows.ok || !totals.ok) throw new Error("Consulta de inscrições indisponível.");
  const applications = (await rows.json()) as AffiliateApplicationRecord[];
  const raw = (await totals.json()) as Partial<Record<AffiliateStatus, number>> | null;
  const range = rows.headers.get("content-range");
  const totalPart = range?.split("/")[1] ?? "0";
  const total = totalPart === "*" ? applications.length : Number(totalPart);
  return {
    applications,
    total: Number.isFinite(total) ? total : applications.length,
    stats: {
      pendente: Number(raw?.pendente ?? 0),
      aprovada: Number(raw?.aprovada ?? 0),
      recusada: Number(raw?.recusada ?? 0),
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

async function finishAffiliateMail(mail: ClaimedMail, success: boolean, providerId: string | null) {
  const response = await requestSupabase("rpc/vonix_affiliate_finish_mail", {
    method: "POST",
    body: JSON.stringify({
      p_mail_id: mail.mail_id,
      p_attempt: mail.attempt,
      p_success: success,
      p_provider_id: providerId,
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
        const data = (await response.json()) as { id?: string };
        providerId = data.id ?? null;
        successful = true;
      }
    } catch {
      // The same immutable idempotency key is used for retries within 20 hours.
    }
    await finishAffiliateMail(mail, successful, providerId);
    if (successful) sent++;
    else failed++;
    // Avoid reclaiming the same candidate in the same run after a transient failure.
    if (!successful) break;
  }
  return { sent, failed, configured: true };
}
