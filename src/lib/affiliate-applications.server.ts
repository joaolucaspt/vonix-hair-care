import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env.server";
import { affiliateResendApiKey } from "./affiliate-resend-config.server";
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
import { affiliateRejectionReasonSchema } from "./affiliate-rejection";
import {
  affiliateSimpleSchema,
  simpleAffiliateSocialUrls,
  type AffiliateSimpleInput,
} from "./affiliate-simple";
import { affiliateTrustedIpHeaderValid } from "./affiliate-throttle.server";
import { ageFromBirthDate, instagramProfileUrl, tiktokProfileUrl } from "./affiliate-wizard";
import {
  affiliateQuestionnaireEncryptionReady,
  affiliateWizardSummary,
  encryptAffiliateWizard,
  encryptSimpleAffiliateApplication,
  decryptAffiliateWizardForAdmin,
  matchesEncryptedSimpleAffiliateApplication,
  MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH,
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

/**
 * Alternate, owner-controlled intake toggle for campaign traffic. The operator
 * acknowledges the data-collection notice in the dedicated Supabase DB.
 * It does NOT grant any administrative session and does not weaken RLS.
 * Legacy full-readiness configuration remains supported unchanged.
 */
export async function affiliateOperatorIntakeEnabled(): Promise<boolean> {
  if (affiliateRecruitmentOpen()) return true;
  const config = affiliateDatabaseConfig();
  if (
    !config ||
    env("AFFILIATE_GOVERNANCE_MIGRATED") !== "true" ||
    env("AFFILIATE_TRAFFIC_PEPPER").length < 32 ||
    !affiliateTrustedIpHeaderValid() ||
    !affiliateQuestionnaireEncryptionReady()
  )
    return false;
  try {
    const response = await fetch(
      config.url +
        "/rest/v1/vonix_affiliate_operator_intake?select=enabled,owner_acknowledged_at&singleton=eq.true&limit=1",
      {
        method: "GET",
        headers: config.headers,
        redirect: "manual",
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) return false;
    const records = z
      .array(
        z.object({
          enabled: z.boolean(),
          owner_acknowledged_at: z.string().datetime({ offset: true }).nullable(),
        }),
      )
      .max(1)
      .parse(await response.json());
    return (
      records.length === 1 &&
      records[0]!.enabled === true &&
      records[0]!.owner_acknowledged_at !== null
    );
  } catch {
    return false;
  }
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
    redirect: "manual",
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
  // This table has three separate unique restrictions: email, Instagram and
  // TikTok. An arbitrary SQLSTATE 23505 does NOT prove the applicant's email
  // was already registered; falsely acknowledging a social-profile collision
  // would silently discard a different candidate's application.
  // PostgreSQL/PostgREST identifies the violated constraint in the message.
  // Return the same public acknowledgement only for the exact email key, and
  // fail closed if the provider does not identify the constraint.
  // Never expose raw database messages/details to the candidate.
  if (response.status === 409) {
    let duplicateEmail = false;
    try {
      const error: unknown = await response.json();
      duplicateEmail =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505" &&
        "message" in error &&
        error.message ===
          'duplicate key value violates unique constraint "vonix_affiliate_applications_email_key"';
    } catch {
      // Malformed/conflicting responses are not proof of an email duplicate.
    }
    if (duplicateEmail) return { ok: true as const };
  }
  if (!response.ok) throw new Error("Falha ao salvar inscrição: HTTP " + response.status);
  return { ok: true as const };
}

/**
 * One-page enrollment: no fictitious email, DOB or hair type is generated.
 * Phone and full address live only inside authenticated encrypted ciphertext.
 * The existing historical records and privileged moderation flows are kept.
 */
export async function createSimpleAffiliateApplication(raw: AffiliateSimpleInput) {
  const data = affiliateSimpleSchema.parse(raw);
  if (data.website) return { ok: true as const };
  const socials = simpleAffiliateSocialUrls(data);
  // One-time private tracking code, never stored in plaintext or sent to Meta.
  const trackingCode = data.trackingCode ?? randomBytes(24).toString("base64url");
  const statusTokenHash = createHash("sha256").update(trackingCode).digest("hex");
  const record = {
    status_token_hash: statusTokenHash,
    full_name: data.fullName,
    city: data.city,
    state: data.state,
    instagram_url: normalizedProfile(socials.instagram_url),
    tiktok_url: socials.tiktok_url ? normalizedProfile(socials.tiktok_url) : null,
    questionnaire_encrypted: encryptSimpleAffiliateApplication(data),
    consent_at: new Date().toISOString(),
  };
  const response = await requestSupabase("vonix_affiliate_applications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(record),
  });
  // A retry with the SAME strong private receipt is idempotent even if the
  // preceding request committed but its HTTP response was lost. A social
  // profile alone is NEVER sufficient proof and must not reveal a receipt.
  if (response.status === 409) {
    if (data.trackingCode) {
      const prior = await requestSupabase(
        "vonix_affiliate_applications?select=instagram_url,status_token_hash,questionnaire_encrypted" +
          "&status_token_hash=eq." +
          encodeURIComponent(statusTokenHash) +
          "&limit=1",
        { method: "GET" },
      );
      if (!prior.ok) throw new Error("Private receipt verification unavailable.");
      const matching = z
        .array(
          z.object({
            instagram_url: z.string().max(400),
            status_token_hash: z.string().regex(/^[a-f0-9]{64}$/),
            questionnaire_encrypted: z
              .string()
              .min(1)
              .max(MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH),
          }),
        )
        .max(1)
        .parse(await prior.json());
      if (
        matching.length === 1 &&
        matching[0]!.status_token_hash === statusTokenHash &&
        normalizedProfile(matching[0]!.instagram_url) ===
          normalizedProfile(socials.instagram_url) &&
        matchesEncryptedSimpleAffiliateApplication(matching[0]!.questionnaire_encrypted, data)
      ) {
        return { ok: true as const, trackingCode };
      }
    }
    return {
      ok: false as const,
      reason:
        "Já pode existir uma candidatura com um desses perfis. Entre em contato com a equipe Vonix.",
    };
  }
  if (!response.ok)
    throw new Error("Não foi possível armazenar candidatura: HTTP " + response.status);
  return { ok: true as const, trackingCode };
}

/** Private lookup: only a 192-bit randomly issued code grants access. */
export async function getAffiliateStatusWithCode(raw: string) {
  const code = z
    .string()
    .regex(/^[a-zA-Z0-9_-]{32}$/)
    .parse(raw);
  const hash = createHash("sha256").update(code).digest("hex");
  const response = await requestSupabase(
    "vonix_affiliate_applications?select=status,rejection_reason,created_at,reviewed_at" +
      "&status_token_hash=eq." +
      encodeURIComponent(hash) +
      "&limit=1",
    { method: "GET" },
  );
  if (!response.ok) throw new Error("Consulta temporariamente indisponível.");
  const parsed = z
    .array(
      z.object({
        status: z.enum(["pendente", "aprovada", "recusada"]),
        rejection_reason: z.string().max(55).nullable(),
        created_at: z.string().max(70),
        reviewed_at: z.string().max(70).nullable(),
      }),
    )
    .max(1)
    .parse(await response.json());
  return parsed[0] ?? null;
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
        affiliateResendApiKey() &&
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
  age: z.number().int().min(18).max(100).nullable(),
  city: z.string().max(90),
  state: z.string().length(2),
  hair_type: z.string().max(50).nullable(),
  email: z.string().email().max(180).nullable(),
  instagram_url: z.string().max(240),
  tiktok_url: z.string().max(240).nullable(),
  motivation: z.string().max(3000).nullable(),
  status: z.enum(["pendente", "aprovada", "recusada"]),
  rejection_reason: z.string().max(55).nullable().default(null),
  created_at: z.string().datetime({ offset: true }).max(64),
  reviewed_at: z.string().datetime({ offset: true }).max(64).nullable(),
  questionnaire_encrypted: z
    .string()
    .max(MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH)
    .nullable()
    .optional(),
  vonix_affiliate_mail_outbox: z
    .array(
      z.object({
        status: validMailStatus,
        sent_at: z.string().datetime({ offset: true }).max(64).nullable(),
      }),
    )
    .max(1)
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

/**
 * Privileged, one-record lookup for the protected admin detail panel only.
 * This is intentionally separate from the paginated listing: no document or
 * full address is ever returned as part of a search or dashboard summary.
 */
export async function readAffiliateApplicationPrivateDetail(applicationId: string) {
  const id = z.string().uuid().parse(applicationId);
  const response = await requestSupabase(
    "vonix_affiliate_applications?select=id,questionnaire_encrypted&id=eq." +
      encodeURIComponent(id) +
      "&limit=1",
    { method: "GET" },
  );
  if (!response.ok) throw new Error("Consulta de detalhe indisponível.");
  const rows = z
    .array(
      z.object({
        id: z.string().uuid(),
        questionnaire_encrypted: z
          .string()
          .max(MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH)
          .nullable(),
      }),
    )
    .max(1)
    .parse(await response.json());
  if (rows.length !== 1 || rows[0]!.id !== id) {
    throw new Error("Questionário indisponível.");
  }
  const detail = decryptAffiliateWizardForAdmin(rows[0]!.questionnaire_encrypted);
  if (!detail) throw new Error("Questionário indisponível ou ilegível.");
  return detail;
}

/**
 * Recover an existing candidate's login without trusting an e-mail submitted
 * by the browser. Always call through an authenticated admin server action.
 * Return only the e-mail, not any encrypted questionnaire fields.
 */
export async function readAffiliateApplicantEmailForAccessRecovery(applicationId: string) {
  const id = z.string().uuid().parse(applicationId);
  const response = await requestSupabase(
    "vonix_affiliate_applications?select=id,email&id=eq." + encodeURIComponent(id) + "&limit=1",
    { method: "GET" },
  );
  if (!response.ok) throw new Error("Candidatura não disponível.");
  const rows = z
    .array(
      z.object({
        id: z.string().uuid(),
        email: z.string().email().max(180).nullable(),
      }),
    )
    .max(1)
    .parse(await response.json());
  if (rows.length !== 1 || rows[0]!.id !== id || !rows[0]!.email) return null;
  return rows[0]!.email.toLowerCase();
}

export async function decideAffiliateApplication(
  id: string,
  decision: "aprovada" | "recusada",
  rejectionReason: string | null = null,
) {
  const response = await requestSupabase("rpc/vonix_affiliate_decide", {
    method: "POST",
    body: JSON.stringify({
      p_id: z.string().uuid().parse(id),
      p_decision: z.enum(["aprovada", "recusada"]).parse(decision),
      p_reason: rejectionReason,
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
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(180)
    .refine(
      (value) =>
        z.string().email().safeParse(value).success || /^[\p{L}.' -]+\s+[\p{L}.' -]+$/u.test(value),
      "Confirmação deve ser e-mail ou nome completo.",
    )
    .parse(confirmedEmail);
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

/**
 * For a historical applicant with a verified e-mail, read only the persisted,
 * standardized moderation reason. Never trust the browser, free text or a
 * provider-supplied reason for a private decision notification.
 */
async function readAffiliateRejectionReasonForMail(applicationId: string) {
  const id = z.string().uuid().parse(applicationId);
  const response = await requestSupabase(
    "vonix_affiliate_applications?select=id,status,rejection_reason&id=eq." +
      encodeURIComponent(id) +
      "&status=eq.recusada&limit=1",
    { method: "GET" },
  );
  if (!response.ok) throw new Error("Rejection reason unavailable.");
  const rows = z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.literal("recusada"),
        rejection_reason: affiliateRejectionReasonSchema,
      }),
    )
    .max(1)
    .parse(await response.json());
  if (rows.length !== 1 || rows[0]!.id !== id) {
    throw new Error("Rejection reason missing or changed.");
  }
  return rows[0]!.rejection_reason;
}

/** Each email is one DB outbox row; Resend de-duplicates retries for 24h. */
export async function processAffiliateEmails(limit = 5, applicationId?: string) {
  const apiKey = affiliateResendApiKey();
  const from = env("AFFILIATE_FROM_EMAIL");
  if (!apiKey || !from) return { sent: 0, failed: 0, configured: false };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < Math.min(Math.max(limit, 0), 10); i++) {
    const mail = await claimAffiliateMail(applicationId);
    if (!mail) break;
    let successful = false;
    let providerId: string | null = null;
    let unknown = false;
    let permanent = false;
    let providerRequestStarted = false;
    try {
      const rejectionReason =
        mail.decision === "recusada"
          ? await readAffiliateRejectionReasonForMail(mail.application_id)
          : null;
      const message = affiliateDecisionEmail(mail.decision, rejectionReason);
      // From this point a network failure can mean the provider accepted mail.
      providerRequestStarted = true;
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
      // A timeout after the outbound request is ambiguous; a failed local
      // reason lookup is not a delivery attempt and can safely be retried.
      unknown = providerRequestStarted;
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
