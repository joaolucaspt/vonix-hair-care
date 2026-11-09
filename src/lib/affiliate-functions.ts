import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { affiliateApplicationSchema, affiliateAdminSchema } from "./affiliate-application";
import { attemptAffiliateAdminLogin } from "./affiliate-admin-auth.server";
import {
  affiliateAdminSameOrigin,
  affiliateAdminSessionValid,
  destroyAffiliateAdminSession,
} from "./affiliate-admin-session.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import {
  affiliateRecruitmentOpen,
  createAffiliateApplication,
  decideAffiliateApplication,
  listAffiliateApplications,
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
        return { ok: true as const, emailSent: send.sent === 1 };
      } catch {
        return { ok: true as const, emailSent: false };
      }
    } catch {
      return {
        ok: false as const,
        reason: "Não foi possível registrar a decisão. Tente novamente.",
      };
    }
  });
