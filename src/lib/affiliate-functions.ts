import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { isIP } from "node:net";
import { affiliateDatabaseConfig } from "./affiliate-database.server";
import { affiliateQuestionnaireEncryptionReady } from "./affiliate-wizard-crypto.server";
import { affiliateApplicationSchema, affiliateAdminSchema } from "./affiliate-application";
import { attemptAffiliateAdminLogin } from "./affiliate-admin-auth.server";
import { loginAffiliateTeamWithPassword } from "./affiliate-member-auth.server";
import { invitePersistedAffiliateApplicant } from "./affiliate-invites.server";
import {
  affiliateAdminSameOrigin,
  affiliateMutationSameOrigin,
  affiliateAdminSessionValid,
  affiliateAdminMayErase,
  destroyAffiliateAdminSession,
} from "./affiliate-admin-session.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import {
  affiliateRecruitmentOpen,
  affiliateOperationalReadiness,
  eraseAffiliateApplication,
  previewAffiliateRetention,
  createAffiliateApplication,
  readAffiliateApplicantEmailForAccessRecovery,
  decideAffiliateApplication,
  listAffiliateApplications,
  readAffiliateApplicationPrivateDetail,
  processAffiliateEmails,
} from "./affiliate-applications.server";

/**
 * Public, read-only readiness probe: never returns any key, customer record,
 * raw IP, SQL result or provider error. Proves the production Worker actually
 * reaches the dedicated DB before advertising a working signup.
 */
export const getAffiliateRecruitmentStatus = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const config = affiliateDatabaseConfig();
  let storageReachable = false;
  let storageDiagnostic:
    | "not-configured"
    | "reachable"
    | "unauthorized"
    | "forbidden"
    | "not-found"
    | "server-error"
    | "network-error" = config ? "network-error" : "not-configured";
  if (config) {
    try {
      const response = await fetch(
        config.url + "/rest/v1/vonix_affiliate_applications?select=id&limit=0",
        {
          method: "GET",
          headers: config.headers,
          redirect: "error",
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
              : "server-error";
    } catch {
      storageReachable = false;
      storageDiagnostic = "network-error";
    }
  }
  const cfConnectingIp = getRequestHeader("cf-connecting-ip")?.trim() ?? "";
  return {
    open: storageReachable && affiliateRecruitmentOpen(),
    storageReachable,
    storageDiagnostic,
    cfConnectingIpPresent: isIP(cfConnectingIp) !== 0,
    encryptionReady: affiliateQuestionnaireEncryptionReady(),
  };
});

export const submitAffiliateApplication = createServerFn({ method: "POST" })
  .validator(affiliateApplicationSchema)
  .handler(async ({ data }) => {
    if (!affiliateRecruitmentOpen()) {
      return {
        ok: false as const,
        reason: "Inscrições ainda não disponíveis. Consulte os canais oficiais da Vonix Hair.",
      };
    }
    if (!affiliateMutationSameOrigin()) {
      return {
        ok: false as const,
        reason: "Envie a candidatura diretamente pelo formulário oficial da Vonix Hair.",
      };
    }
    // The public registration form now uses the full five-stage questionnaire.
    // Legacy simplified payloads are never accepted through this public endpoint.
    if (!data.wizard) {
      return { ok: false as const, reason: "Preencha as cinco etapas do cadastro." };
    }
    if (!(await consumeAffiliateRateLimit("submit"))) {
      return {
        ok: false as const,
        reason: "Muitas tentativas ou serviço temporariamente indisponível. Tente mais tarde.",
      };
    }
    try {
      const result = await createAffiliateApplication(data);
      if (result.ok && !data.website && data.wizard) {
        // A successful durable insert or a verified email duplicate precedes
        // any Auth invitation. Never provision a login for honeypots.
        const inviteSent = await invitePersistedAffiliateApplicant(data.wizard.email);
        return { ...result, inviteSent };
      }
      return result;
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível receber sua inscrição agora. Tente novamente mais tarde.",
      };
    }
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
      emailConfirmation: z.string().trim().toLowerCase().email().max(180),
      reason: z.enum(["solicitacao_titular", "retencao", "correcao"]),
    }),
  )
  .handler(async ({ data }) => {
    if (!affiliateAdminSameOrigin() || !affiliateAdminMayErase())
      return { ok: false as const, reason: "Acesso negado. Faça login novamente." };
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
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["aprovada", "recusada"]),
    }),
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
      const updated = await decideAffiliateApplication(data.id, data.decision);
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
