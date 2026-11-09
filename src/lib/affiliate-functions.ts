import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { affiliateApplicationSchema, affiliateAdminSchema } from "./affiliate-application";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";
import {
  affiliateAdminAuthorized,
  createAffiliateApplication,
  decideAffiliateApplication,
  listAffiliateApplications,
  processAffiliateEmails,
} from "./affiliate-applications.server";

export const submitAffiliateApplication = createServerFn({ method: "POST" })
  .inputValidator(affiliateApplicationSchema)
  .handler(async ({ data }) => {
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

export const getAffiliateApplications = createServerFn({ method: "POST" })
  .inputValidator(
    affiliateAdminSchema.extend({
      status: z.enum(["pendente", "aprovada", "recusada"]),
      page: z.number().int().min(0).max(50000),
      search: z.string().trim().max(70).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!affiliateAdminAuthorized(data.password)) {
      await consumeAffiliateRateLimit("admin");
      return { ok: false as const, reason: "Acesso negado ou painel não configurado." };
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
  .inputValidator(
    affiliateAdminSchema.extend({
      id: z.string().uuid(),
      decision: z.enum(["aprovada", "recusada"]),
    }),
  )
  .handler(async ({ data }) => {
    if (!affiliateAdminAuthorized(data.password)) {
      await consumeAffiliateRateLimit("admin");
      return { ok: false as const, reason: "Acesso negado." };
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
