import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { isIP } from "node:net";
import { affiliateDatabaseConfig } from "./affiliate-database.server";
import { VONIX_AFFILIATE_AUTH_URL, VONIX_AFFILIATE_PUBLIC_KEY } from "./vonix-affiliate-auth";
import { affiliateQuestionnaireEncryptionReady } from "./affiliate-wizard-crypto.server";
import { affiliateApplicationSchema, affiliateAdminSchema } from "./affiliate-application";
import { affiliateSimpleSchema } from "./affiliate-simple";
import { affiliateRejectionReasonSchema } from "./affiliate-rejection";
import { attemptAffiliateAdminLogin } from "./affiliate-admin-auth.server";
import { loginAffiliateTeamWithPassword } from "./affiliate-member-auth.server";
import {
  generatePendingAffiliateOwnerActivationLink,
  diagnoseAffiliateOwnerSender,
  listPendingAffiliateOwnerActivations,
  sendPendingAffiliateOwnerActivationEmail,
  affiliateActivatedOwnerStillAuthorized,
} from "./affiliate-owner-activation.server";
import { invitePersistedAffiliateApplicant } from "./affiliate-invites.server";
import {
  affiliateCustomAuthEmailReady,
  affiliateEmailAuthorizedForPortal,
  sendAffiliateAuthEmailWithResend,
  sendAffiliateManagedAuthOtp,
} from "./affiliate-auth-delivery.server";
import {
  affiliateAdminSameOrigin,
  affiliateMutationSameOrigin,
  affiliateAdminSessionValid,
  affiliateAdminMayErase,
  affiliateLegacyAdminSessionValid,
  destroyAffiliateAdminSession,
} from "./affiliate-admin-session.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import {
  affiliateRecruitmentOpen,
  affiliateOperatorIntakeEnabled,
  affiliateOperationalReadiness,
  eraseAffiliateApplication,
  previewAffiliateRetention,
  createSimpleAffiliateApplication,
  getAffiliateStatusWithCode,
  readAffiliateApplicantEmailForAccessRecovery,
  decideAffiliateApplication,
  listAffiliateApplications,
  readAffiliateApplicationPrivateDetail,
  processAffiliateEmails,
} from "./affiliate-applications.server";

function classifyAffiliateFetchFailure(error: unknown): string {
  // Only a fixed, non-sensitive category is returned to callers.
  // Never return the raw error or any header/secret content.
  const name =
    typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : "";
  if (/timeout|abort/i.test(name + " " + message)) return "timeout";
  if (/redirect/i.test(message)) return "redirect";
  if (/header/i.test(message)) return "invalid-header";
  if (name === "TypeError") return "type-error";
  return "network-error";
}

/**
 * Public, read-only readiness probe: never returns any key, customer record,
 * raw IP, SQL result or provider error. Proves the production Worker actually
 * reaches the dedicated DB before advertising a working signup.
 */
export const getAffiliateRecruitmentStatus = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const config = affiliateDatabaseConfig();
  let storageReachable = false;
  // Public-key probe is safe and independent of the privileged secret.
  // A successful HTTP response (including 401/403) proves Worker egress
  // without exposing or querying any candidate data.
  let publicNetworkDiagnostic = "network-error";
  try {
    const response = await fetch(
      VONIX_AFFILIATE_AUTH_URL + "/rest/v1/vonix_affiliate_applications?select=id&limit=0",
      {
        method: "GET",
        headers: { apikey: VONIX_AFFILIATE_PUBLIC_KEY },
        redirect: "manual",
        signal: AbortSignal.timeout(6500),
      },
    );
    publicNetworkDiagnostic =
      response.status === 401
        ? "unauthorized"
        : response.status === 403
          ? "forbidden"
          : response.ok
            ? "reachable"
            : "http-" + response.status;
  } catch (error) {
    publicNetworkDiagnostic = classifyAffiliateFetchFailure(error);
  }
  let storageDiagnostic: string = config ? "network-error" : "not-configured";
  if (config) {
    try {
      const response = await fetch(
        config.url + "/rest/v1/vonix_affiliate_applications?select=id&limit=0",
        {
          method: "GET",
          headers: config.headers,
          // Strict redirect:error throws on some Worker fetch adapters.
          // Manual mode never forwards privileged credentials to a new host.
          redirect: "manual",
          signal: AbortSignal.timeout(4000),
        },
      );
      storageReachable = response.ok;
      storageDiagnostic = response.ok
        ? "reachable"
        : response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : response.status === 404
              ? "not-found"
              : response.status >= 300 && response.status < 400
                ? "redirect-blocked"
                : "server-error";
    } catch (error) {
      storageReachable = false;
      storageDiagnostic = classifyAffiliateFetchFailure(error);
    }
  }
  const cfConnectingIp = getRequestHeader("cf-connecting-ip")?.trim() ?? "";
  const operatorIntakeReady = storageReachable && (await affiliateOperatorIntakeEnabled());
  const rateLimitReady = operatorIntakeReady && (await affiliateRateLimitAllowed("submit"));
  return {
    open: rateLimitReady,
    intakeEnabled: operatorIntakeReady,
    rateLimitReady,
    storageReachable,
    storageDiagnostic,
    publicNetworkDiagnostic,
    cfConnectingIpPresent: isIP(cfConnectingIp) !== 0,
    encryptionReady: affiliateQuestionnaireEncryptionReady(),
    transactionalEmailConfigured: affiliateCustomAuthEmailReady(),
  };
});

/**
 * Auth e-mail provider recovery: use a verified transactional sender when
 * configured, but never let the public browser choose an arbitrary recipient.
 * Applicant access is limited to persisted applications; team access is
 * limited to the explicit administrator invitation roster.
 */
export const requestAffiliateAccessEmail = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().trim().toLowerCase().email().max(180),
      purpose: z.enum(["applicant", "owner"]),
    }),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    if (!affiliateMutationSameOrigin()) return { status: "denied" as const };
    if (!(await consumeAffiliateRateLimit("admin"))) {
      return { status: "rate-limited" as const };
    }
    try {
      const authorized = await affiliateEmailAuthorizedForPortal(data.email, data.purpose);
      if (!authorized) {
        // Equal response for an address without a persisted candidate/member.
        return { status: "requested" as const };
      }
      if (affiliateCustomAuthEmailReady()) {
        await sendAffiliateAuthEmailWithResend(data.email, data.purpose);
      } else {
        // Only preauthorized recipients can use the managed Supabase fallback.
        // No public browser is permitted to create Auth users or choose targets.
        await sendAffiliateManagedAuthOtp(data.email, data.purpose);
      }
      // Do not expose account existence or provider-specific failures.
      return { status: "requested" as const };
    } catch {
      // Fixed operator-only category: never log the address, code, link or error body.
      console.warn("[vonix-affiliate-auth-mail] request-exception http=none");
      return { status: "requested" as const };
    }
  });

export const submitSimpleAffiliateApplication = createServerFn({ method: "POST" })
  .validator(affiliateSimpleSchema)
  .handler(async ({ data }) => {
    // A successful response includes a private 192-bit tracking bearer.
    // Never permit browser/proxy caching or referrer propagation of this response.
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!(await affiliateOperatorIntakeEnabled())) {
      return {
        ok: false as const,
        reason:
          "As inscrições ainda não estão disponíveis. Consulte os canais oficiais da Vonix Hair.",
      };
    }
    if (!affiliateMutationSameOrigin()) {
      return {
        ok: false as const,
        reason: "Envie a inscrição pelo formulário oficial da Vonix Hair.",
      };
    }
    if (!(await consumeAffiliateRateLimit("submit"))) {
      return {
        ok: false as const,
        reason: "Muitas tentativas ou serviço temporariamente indisponível. Tente mais tarde.",
      };
    }
    try {
      return await createSimpleAffiliateApplication(data);
    } catch {
      // Never return SQL or encrypted PII in a public error.
      return {
        ok: false as const,
        reason: "Não foi possível receber a inscrição agora. Tente novamente mais tarde.",
      };
    }
  });

/** Secure, rate-limited status lookup for the new email-less applications. */
export const getAffiliateStatusByCode = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(32).max(32) }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!affiliateMutationSameOrigin()) return { ok: false as const, reason: "Acesso inválido." };
    // Status reads must never consume the limited write/submission budget.
    if (!(await consumeAffiliateRateLimit("status")))
      return { ok: false as const, reason: "Muitas consultas. Tente mais tarde." };
    try {
      const result = await getAffiliateStatusWithCode(data.code);
      if (!result)
        return { ok: false as const, reason: "Código não encontrado. Confira e tente novamente." };
      return {
        ok: true as const,
        status: result.status,
        rejectionReason: affiliateRejectionReasonSchema.safeParse(result.rejection_reason).success
          ? result.rejection_reason
          : null,
        submittedAt: result.created_at,
        reviewedAt: result.reviewed_at,
      };
    } catch {
      return { ok: false as const, reason: "Não foi possível consultar agora. Tente novamente." };
    }
  });

/** Retired five-stage endpoint: cached old clients cannot collect extra PII.
 * Keep a harmless compatibility response, while historical records and
 * their verified e-mail tracking remain available via the existing portal.
 */
export const submitAffiliateApplication = createServerFn({ method: "POST" })
  .validator(affiliateApplicationSchema)
  .handler(async () => {
    setResponseHeader("Cache-Control", "no-store");
    return {
      ok: false as const,
      reason:
        "O cadastro antigo foi encerrado. Inscreva-se pelo formulário simplificado em /seja-afiliada.",
    };
  });

/** Manual recovery: retry an applicant's Auth invite, by stored record ID only.
 * A reviewer must confirm this action. No client-submitted email is trusted.
 * Provider acceptance does not prove that the candidate received a message.
 */
export const resendAffiliateApplicantInvite = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid()) {
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    }
    if (!(await consumeAffiliateRateLimit("admin"))) {
      return {
        ok: false as const,
        reason: "Limite de solicitações alcançado. Tente novamente mais tarde.",
      };
    }
    try {
      const email = await readAffiliateApplicantEmailForAccessRecovery(data.id);
      if (!email) return { ok: false as const, reason: "Candidatura não encontrada." };
      const accepted = await invitePersistedAffiliateApplicant(email);
      if (!accepted) {
        return {
          ok: false as const,
          reason:
            "O provedor não confirmou o convite. Se a conta já existir, oriente a candidata a solicitar um código no portal de acompanhamento.",
        };
      }
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível solicitar o acesso. Verifique a conexão com o Supabase.",
      };
    }
  });

/**
 * Authorized owner-only manual invitation recovery. Links are never logged,
 * cached or persisted. The owner must deliver them privately to the intended
 * recipient, who still verifies the token and creates an individual password.
 */
/** Protected owner-only, no-send Resend verification. Does not reveal keys. */
export const inspectAffiliateOwnerSenderStatus = createServerFn({ method: "POST" }).handler(
  async () => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    return diagnoseAffiliateOwnerSender();
  },
);

export const getPendingAffiliateOwnerActivations = createServerFn({ method: "POST" }).handler(
  async () => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    return listPendingAffiliateOwnerActivations();
  },
);

/** Resend from a current activated owner: no URL/token is returned to the browser. */
export const resendPendingAffiliateOwnerEmail = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().trim().toLowerCase().email().max(180) }).strict())
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    return sendPendingAffiliateOwnerActivationEmail(data.email);
  });

export const createPendingAffiliateOwnerActivationLink = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().trim().toLowerCase().email().max(180) }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    return generatePendingAffiliateOwnerActivationLink(data.email);
  });

export const loginAffiliateAdminMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email().max(180),
      password: z.string().min(12).max(128),
    }),
  )
  .handler(async ({ data }) => loginAffiliateTeamWithPassword(data.email, data.password));

export const loginAffiliateAdmin = createServerFn({ method: "POST" })
  .validator(affiliateAdminSchema.extend({ otp: z.string().max(6).optional() }))
  .handler(async ({ data }) => attemptAffiliateAdminLogin(data.password, data.otp ?? ""));

export const getAffiliateAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  return { authenticated: affiliateAdminSessionValid() };
});

export const logoutAffiliateAdmin = createServerFn({ method: "POST" }).handler(async () => {
  if (!affiliateAdminSameOrigin()) return { ok: false as const };
  destroyAffiliateAdminSession();
  return { ok: true as const };
});

/** On-demand confidential answers: authenticated/TOTP session and same-origin only. */
export const getAffiliateApplicationPrivateDetail = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid()) {
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    }
    if (!(await affiliateRateLimitAllowed("admin"))) {
      return { ok: false as const, reason: "Acesso temporariamente indisponível." };
    }
    try {
      const detail = await readAffiliateApplicationPrivateDetail(data.id);
      return { ok: true as const, detail };
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível ler o questionário protegido. Verifique o banco e a chave.",
      };
    }
  });

export const getAffiliateApplications = createServerFn({ method: "POST" })
  .validator(
    z.object({
      status: z.enum(["pendente", "aprovada", "recusada", "todas"]),
      page: z.number().int().min(0).max(50000),
      search: z.string().trim().max(70).optional(),
      mailStatus: z
        .enum(["pendente", "processando", "enviado", "falhou", "incerto"])
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Private admin data/diagnostics: never cache or reveal through referrers.
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid()) {
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    }
    if (!(await affiliateRateLimitAllowed("admin"))) {
      return {
        ok: false as const,
        reason: "Acesso temporariamente indisponível. Tente mais tarde.",
      };
    }
    try {
      const list = await listAffiliateApplications(data);
      return { ok: true as const, ...list };
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível carregar as inscrições. Verifique a configuração do banco.",
      };
    }
  });

/** Restricted configuration and read-only RPC probes. No secrets or applicant data. */
export const getAffiliateOperationalReadiness = createServerFn({ method: "POST" }).handler(
  async () => {
    // Private admin data/diagnostics: never cache or reveal through referrers.
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid())
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    if (!(await affiliateRateLimitAllowed("admin")))
      return { ok: false as const, reason: "Acesso temporariamente indisponível." };
    try {
      const readiness = await affiliateOperationalReadiness();
      return { ok: true as const, ...readiness };
    } catch {
      return { ok: false as const, reason: "Diagnóstico indisponível." };
    }
  },
);

/** A verified GDPR/LGPD deletion request. Never accept the operation anonymously. */
export const eraseAffiliateApplicationAdmin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      emailConfirmation: z.string().trim().min(3).max(180),
      reason: z.enum(["solicitacao_titular", "retencao", "correcao"]),
    }),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    const denied = { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    if (!affiliateAdminSameOrigin() || !affiliateAdminMayErase()) return denied;
    // Re-check activation and owner role against the current protected roster
    // before irreversible LGPD erasure. A valid one-hour member cookie may
    // outlive a role removal. Legacy TOTP owners retain their own distinct
    // signed-session authorization pathway.
    try {
      if (!affiliateLegacyAdminSessionValid() && !(await affiliateActivatedOwnerStillAuthorized()))
        return denied;
    } catch {
      return denied;
    }
    if (!(await affiliateRateLimitAllowed("admin")))
      return { ok: false as const, reason: "Acesso temporariamente indisponível." };
    try {
      const erased = await eraseAffiliateApplication(data.id, data.emailConfirmation, data.reason);
      return erased
        ? { ok: true as const }
        : {
            ok: false as const,
            reason:
              "Exclusão não autorizada: confira o e-mail ou aguarde o processamento da notificação.",
          };
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível executar a exclusão. Verifique a migração de governança.",
      };
    }
  });

/** This is a read-only estimate, not an automatic deletion. */
export const getAffiliateRetentionPreview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pendingDays: z.number().int().min(30).max(3650),
      rejectedDays: z.number().int().min(30).max(3650),
    }),
  )
  .handler(async ({ data }) => {
    // Private admin data/diagnostics: never cache or reveal through referrers.
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Referrer-Policy", "no-referrer");
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid())
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    if (!(await affiliateRateLimitAllowed("admin")))
      return { ok: false as const, reason: "Acesso temporariamente indisponível." };
    try {
      const result = await previewAffiliateRetention(data.pendingDays, data.rejectedDays);
      return { ok: true as const, ...result };
    } catch {
      return { ok: false as const, reason: "Prévia de retenção indisponível." };
    }
  });

export const reviewAffiliateApplication = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["aprovada", "recusada"]),
        reason: affiliateRejectionReasonSchema.nullable(),
      })
      .refine(
        ({ decision, reason }) => (decision === "recusada" ? reason !== null : reason === null),
        "Selecione um motivo para a recusa.",
      ),
  )
  .handler(async ({ data }) => {
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid()) {
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
    }
    if (!(await affiliateRateLimitAllowed("admin"))) {
      return {
        ok: false as const,
        reason: "Acesso temporariamente indisponível. Tente mais tarde.",
      };
    }
    try {
      const updated = await decideAffiliateApplication(data.id, data.decision, data.reason);
      if (!updated)
        return {
          ok: false as const,
          reason: "Inscrição já analisada ou não encontrada. Atualize a lista.",
        };
      // The decision is committed atomically before any email attempt.
      // Failure to send never silently rolls back an approval.
      try {
        const send = await processAffiliateEmails(1, data.id);
        // Provider acceptance is not delivery, and an unconfigured sender is
        // different from a failed or ambiguous attempt requiring reconciliation.
        const notification = (
          send.sent === 1
            ? "accepted"
            : !send.configured
              ? "unconfigured"
              : send.failed > 0
                ? "review"
                : "queued"
        ) as "accepted" | "unconfigured" | "review" | "queued";
        return { ok: true as const, emailSent: send.sent === 1, notification };
      } catch {
        return { ok: true as const, emailSent: false, notification: "review" as const };
      }
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível registrar a decisão. Tente novamente.",
      };
    }
  });
