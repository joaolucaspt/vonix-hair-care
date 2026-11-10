import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { affiliateApplicationSchema, affiliateAdminSchema } from "./affiliate-application";
import { attemptAffiliateAdminLogin } from "./affiliate-admin-auth.server";
import {
  affiliateAdminSameOrigin,
  affiliateMutationSameOrigin,
  affiliateAdminSessionValid,
  destroyAffiliateAdminSession,
} from "./affiliate-admin-session.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import {
  affiliateRecruitmentOpen,
  affiliateOperationalReadiness,
  eraseAffiliateApplication,
  previewAffiliateRetention,
  createAffiliateApplication,
  decideAffiliateApplication,
  listAffiliateApplications,
  readAffiliateApplicationPrivateDetail,
  processAffiliateEmails,
} from "./affiliate-applications.server";

/** Public, non-secret status used only to avoid presenting a broken form. */
export const getAffiliateRecruitmentStatus = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  return { open: affiliateRecruitmentOpen() };
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
      return await createAffiliateApplication(data);
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível receber sua inscrição agora. Tente novamente mais tarde.",
      };
    }
  });

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
    if (!affiliateAdminSameOrigin() || !affiliateAdminSessionValid())
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
