import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env.server";
import {
  affiliateDatabaseConfig,
  requireAffiliateDatabaseConfig,
} from "./affiliate-database.server";
import {
  affiliateApplicationSchema,
  type AffiliateApplicationInput,
  type AffiliateApplicationRecord,
  type AffiliateStatus,
} from "./affiliate-application";
import { affiliateDecisionEmail } from "./affiliate-email";
import { affiliateTrustedIpHeaderValid } from "./affiliate-throttle.server";
import { ageFromBirthDate, instagramProfileUrl, tiktokProfileUrl } from "./affiliate-wizard";
import {
  affiliateQuestionnaireEncryptionReady,
  affiliateWizardSummary,
  encryptAffiliateWizard,
} from "./affiliate-wizard-crypto.server";

const nonNegativeCount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const affiliateStatsSchema = z.object({
  pendente: nonNegativeCount,
  aprovada: nonNegativeCount,
  recusada: nonNegativeCount,
  email_pendente: nonNegativeCount,
  email_processando: nonNegativeCount,
  email_enviado: nonNegativeCount,
  email_falhou: nonNegativeCount,
  email_incerto: nonNegativeCount,
});
const affiliateRetentionStatsSchema = z.object({
  pending_eligible: nonNegativeCount,
  rejected_eligible: nonNegativeCount,
});

/**
 * Publishing the source must never advertise an open signup before infrastructure
 * has been configured and independently tested by an operator.
 */
export function affiliateRecruitmentOpen(): boolean {
  if (env("AFFILIATE_RECRUITMENT_OPEN") !== "true") return false;
  // Explicit operator attestations prevent opening PII collection before
  // the real DB migration and legally reviewed privacy terms are approved.
  if (env("AFFILIATE_GOVERNANCE_MIGRATED") !== "true") return false;
  if (env("AFFILIATE_PRIVACY_POLICY_APPROVED") !== "true") return false;
  if (env("AFFILIATE_PROVIDER_VERIFIED") !== "true") return false;
  if (!affiliateDatabaseConfig()) return false;
  const otp = env("AFFILIATE_ADMIN_TOTP_SECRET").replace(/\s/g, "");
  return Boolean(
    env("AFFILIATE_TRAFFIC_PEPPER").length >= 32 &&
    affiliateTrustedIpHeaderValid() &&
    affiliateQuestionnaireEncryptionReady() &&
    env("AFFILIATE_ADMIN_PASSWORD").length >= 16 &&
    env("AFFILIATE_ADMIN_SESSION_SECRET").length >= 32 &&
    /^[A-Z2-7]{32,128}$/i.test(otp),
    // Email notifications are optional for receiving applications. A missing
    // Resend sender never authorizes sending or relaxes PII security checks.
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
  const config = requireAffiliateDatabaseConfig();
  const response = await fetch(config.url + "/rest/v1/" + route, {
    ...init,
    headers: { ...config.headers, ...init?.headers },
    // Do not follow unexpected redirects with privileged credentials.
    redirect: "error",
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
  // For five-stage applications, the validated answers are authoritative.
  // The legacy scalar fields cannot override identity or social accounts.
  const wizard = data.wizard;
  const record = wizard
    ? {
        full_name: wizard.firstName + " " + wizard.lastName,
        age: ageFromBirthDate(wizard.birthDate),
        city: wizard.city,
        state: wizard.state,
        hair_type: wizard.hairType,
        email: wizard.email.trim().toLowerCase(),
        instagram_url: normalizedProfile(instagramProfileUrl(wizard.instagramUsername)),
        tiktok_url: wizard.tiktokUsername
          ? normalizedProfile(tiktokProfileUrl(wizard.tiktokUsername))
          : null,
        motivation: data.motivation ?? null,
        questionnaire_encrypted: encryptAffiliateWizard(wizard),
        consent_at: new Date().toISOString(),
      }
    : {
        full_name: data.fullName,
        age: data.age,
        city: data.city,
        state: data.state,
        hair_type: data.hairType,
        email: data.email,
        instagram_url: normalizedProfile(data.instagram),
        tiktok_url: data.tiktok ? normalizedProfile(data.tiktok) : null,
        motivation: data.motivation ?? null,
        consent_at: new Date().toISOString(),
      };
  const response = await requestSupabase("vonix_affiliate_applications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(record),
  });
  // A duplicate e-mail/profile gets the same public response to prevent account enumeration.
  if (response.status === 409) return { ok: true as const };
  if (!response.ok) throw new Error("Falha ao salvar inscrição: HTTP " + response.status);
  return { ok: true as const };
}

export async function affiliateOperationalReadiness() {
  const dbConfigured = Boolean(affiliateDatabaseConfig());
  const recruitmentOpen = affiliateRecruitmentOpen();
  const otp = env("AFFILIATE_ADMIN_TOTP_SECRET").replace(/\s/g, "");
  const checks = [
    {
      id: "database",
      label:
        "Supabase dedicado identificado e separado do checkout (URL, projeto e chave privados)",
      ok: dbConfigured,
    },
    {
      id: "migration",
      label: "Migração de governança atestada",
      ok: env("AFFILIATE_GOVERNANCE_MIGRATED") === "true",
    },
    {
      id: "privacy",
      label: "Política de privacidade aprovada",
      ok: env("AFFILIATE_PRIVACY_POLICY_APPROVED") === "true",
    },
    {
      id: "provider",
      label: "Hospedagem e proxy homologados",
      ok: env("AFFILIATE_PROVIDER_VERIFIED") === "true",
    },
    {
      id: "admin",
      label: "Senha e sessão administrativas",
      ok:
        env("AFFILIATE_ADMIN_PASSWORD").length >= 16 &&
        env("AFFILIATE_ADMIN_SESSION_SECRET").length >= 32,
    },
    {
      id: "totp",
      label: "Autenticador de dois fatores",
      ok: /^[A-Z2-7]{32,128}$/i.test(otp),
    },
    {
      id: "proxy",
      label: "Proxy confiável configurado",
      ok: affiliateTrustedIpHeaderValid() && env("AFFILIATE_TRAFFIC_PEPPER").length >= 32,
    },
    {
      id: "encryption",
      label: "Criptografia de dados pessoais",
      ok: affiliateQuestionnaireEncryptionReady(),
    },
    {
      id: "resend",
      label: "Notificações por e-mail (opcional para inscrições)",
      ok: Boolean(
        env("RESEND_API_KEY") &&
        env("AFFILIATE_FROM_EMAIL") &&
        env("AFFILIATE_WORKER_SECRET").length >= 24,
      ),
    },
    {
      id: "launch",
      label: "Abertura operacional efetivamente liberada",
      ok: recruitmentOpen,
    },
  ];
  let databaseResponding = false;
  let governanceResponding = false;
  if (dbConfigured) {
    // HTTP 200 alone does not prove an RPC returns usable, correctly migrated
    // data. Probe each read-only endpoint independently and validate its shape.
    // Never expose credentials, provider error bodies or applicant records.
    const [statsHealthy, governanceHealthy] = await Promise.all([
      requestSupabase("rpc/vonix_affiliate_stats", { method: "POST", body: "{}" })
        .then(
          async (response) =>
            response.ok && affiliateStatsSchema.safeParse(await response.json()).success,
        )
        .catch(() => false),
      requestSupabase("rpc/vonix_affiliate_retention_preview", {
        method: "POST",
        body: JSON.stringify({ p_pending_days: 90, p_rejected_days: 180 }),
      })
        .then(
          async (response) =>
            response.ok && affiliateRetentionStatsSchema.safeParse(await response.json()).success,
        )
        .catch(() => false),
    ]);
    databaseResponding = statsHealthy;
    governanceResponding = governanceHealthy;
  }
  return {
    recruitmentOpen,
    checks,
    databaseResponding,
    governanceResponding,
    providerDeliveryVerifiedByThisCheck: false,
  };
}

export type AffiliateListStatus = AffiliateStatus | "todas";
export type AffiliateMailStatus = "pendente" | "processando" | "enviado" | "falhou" | "incerto";

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

const validStatus = z.enum(["pendente", "aprovada", "recusada", "todas"]);
const validMailStatus = z.enum(["pendente", "processando", "enviado", "falhou", "incerto"]);

// A private RPC response is NOT a browser-facing DTO. Explicitly project every
// field that the triage screen is allowed to receive. A future database migration
// must never accidentally expose plaintext documents, addresses, tokens or PII.
const affiliateAdminRowSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).max(120),
  age: z.number().int().min(18).max(100),
  city: z.string().max(90),
  state: z.string().length(2),
  hair_type: z.string().max(50),
  email: z.string().email().max(180),
  instagram_url: z.string().max(240),
  tiktok_url: z.string().max(240).nullable(),
  motivation: z.string().max(3000).nullable(),
  status: z.enum(["pendente", "aprovada", "recusada"]),
  created_at: z.string().datetime({ offset: true }).max(64),
  reviewed_at: z.string().datetime({ offset: true }).max(64).nullable(),
  questionnaire_encrypted: z.string().nullable().optional(),
  vonix_affiliate_mail_outbox: z
    .array(z.object({ status: validMailStatus, sent_at: z.string().max(64).nullable() }))
    .nullable()
    .optional(),
});

export async function listAffiliateApplications(input: {
  status: AffiliateListStatus;
  page: number;
  search?: string | undefined;
  mailStatus?: AffiliateMailStatus | null | undefined;
}): Promise<AffiliateList> {
  const status = validStatus.parse(input.status);
  const mailStatus = input.mailStatus == null ? null : validMailStatus.parse(input.mailStatus);
  const page = z.number().int().min(0).max(50000).parse(input.page);
  const q = z
    .string()
    .trim()
    .max(70)
    .parse(input.search ?? "");
  const [rows, totals] = await Promise.all([
    requestSupabase("rpc/vonix_affiliate_search", {
      method: "POST",
      body: JSON.stringify({
        p_status: status,
        p_query: q,
        p_offset: page * 40,
        p_limit: 40,
        p_mail_status: mailStatus,
      }),
    }),
    requestSupabase("rpc/vonix_affiliate_stats", { method: "POST", body: "{}" }),
  ]);
  if (!rows.ok || !totals.ok) throw new Error("Consulta de inscrições indisponível.");
  const result = (await rows.json()) as { total?: unknown; applications?: unknown };
  const raw: unknown = await totals.json();
  const checkedTotal = nonNegativeCount.safeParse(result?.total);
  if (
    !Array.isArray(result?.applications) ||
    result.applications.length > 40 ||
    !checkedTotal.success
  ) {
    throw new Error("Formato inválido da consulta de inscrições.");
  }
  // The RPC is privileged and may evolve independently of the browser. Zod
  // strips unknown keys, but ciphertext is handled separately on the server.
  // Never spread a raw database object into a client response.
  const applications: AffiliateApplicationRecord[] = result.applications.map((value) => {
    const row = affiliateAdminRowSchema.parse(value);
    const { questionnaire_encrypted, vonix_affiliate_mail_outbox, ...visible } = row;
    return {
      ...visible,
      ...(vonix_affiliate_mail_outbox === undefined ? {} : { vonix_affiliate_mail_outbox }),
      questionnaireSummary: affiliateWizardSummary(questionnaire_encrypted),
    };
  });
  const counters = affiliateStatsSchema.parse(raw);
  return {
    applications,
    total: checkedTotal.data,
    stats: {
      pendente: counters.pendente,
      aprovada: counters.aprovada,
      recusada: counters.recusada,
    },
    mailStats: {
      pendente: counters.email_pendente,
      processando: counters.email_processando,
      enviado: counters.email_enviado,
      falhou: counters.email_falhou,
      incerto: counters.email_incerto,
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

export const affiliateErasureReasons = ["solicitacao_titular", "retencao", "correcao"] as const;
export type AffiliateErasureReason = (typeof affiliateErasureReasons)[number];

/**
 * Restricted deletion of verified applicant records. The database transaction
 * cancels all unclaimed email messages, strips ciphertext, and records a
 * non-identifying audit event; an in-flight send blocks the deletion.
 */
export async function eraseAffiliateApplication(
  id: string,
  confirmedEmail: string,
  reason: AffiliateErasureReason,
): Promise<boolean> {
  const parsedId = z.string().uuid().parse(id);
  const email = z.string().trim().toLowerCase().email().max(180).parse(confirmedEmail);
  const parsedReason = z.enum(affiliateErasureReasons).parse(reason);
  const response = await requestSupabase("rpc/vonix_affiliate_erase", {
    method: "POST",
    body: JSON.stringify({
      p_id: parsedId,
      p_confirmation_email: email,
      p_reason: parsedReason,
    }),
  });
  if (!response.ok) throw new Error("Exclusão não disponível.");
  return (await response.json()) === true;
}

export async function previewAffiliateRetention(pendingDays: number, rejectedDays: number) {
  const pending = z.number().int().min(30).max(3650).parse(pendingDays);
  const rejected = z.number().int().min(30).max(3650).parse(rejectedDays);
  const response = await requestSupabase("rpc/vonix_affiliate_retention_preview", {
    method: "POST",
    body: JSON.stringify({ p_pending_days: pending, p_rejected_days: rejected }),
  });
  if (!response.ok) throw new Error("Prévia de retenção não disponível.");
  // Never render a fabricated zero, NaN, or infinity when the database
  // returns an unexpected shape. This RPC is a read-only estimate.
  const result = affiliateRetentionStatsSchema.parse(await response.json());
  return {
    pendingEligible: result.pending_eligible,
    rejectedEligible: result.rejected_eligible,
    executedDeletions: 0,
  };
}

// A privileged queue response is not automatically safe to send to a third
// party. Reject malformed recipients, decisions and claim identifiers before
// any Resend request; the database claim can then be reconciled by an operator.
const claimedMailSchema = z.object({
  mail_id: z.string().uuid(),
  application_id: z.string().uuid(),
  recipient: z.string().trim().toLowerCase().email().max(180),
  decision: z.enum(["aprovada", "recusada"]),
  attempt: z.number().int().min(1).max(2_147_483_647),
});
type ClaimedMail = z.infer<typeof claimedMailSchema>;

async function claimAffiliateMail(id?: string): Promise<ClaimedMail | null> {
  const response = await requestSupabase("rpc/vonix_affiliate_claim_mail", {
    method: "POST",
    body: JSON.stringify({ p_application_id: id ?? null }),
  });
  if (!response.ok) throw new Error("Não foi possível reservar notificação.");
  const results = z
    .array(claimedMailSchema)
    .max(1)
    .parse(await response.json());
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
        if (typeof data.id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(data.id)) {
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
