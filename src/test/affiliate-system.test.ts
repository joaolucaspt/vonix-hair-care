import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { affiliateApplicationSchema } from "@/lib/affiliate-application";
import { affiliateDecisionEmail } from "@/lib/affiliate-email";
import {
  affiliateAdminAuthorized,
  affiliateOperationalReadiness,
  createAffiliateApplication,
  decideAffiliateApplication,
  eraseAffiliateApplication,
  previewAffiliateRetention,
  listAffiliateApplications,
  processAffiliateEmails,
} from "@/lib/affiliate-applications.server";

const valid = {
  fullName: "Maria Aparecida Souza",
  age: 27,
  city: "Belo Horizonte",
  state: "MG",
  hairType: "Cacheado",
  email: "MARIA@EXAMPLE.COM",
  instagram: "https://www.instagram.com/maria.cachos/",
  tiktok: "https://www.tiktok.com/@maria.cachos",
  motivation:
    "Quero compartilhar minhas experiências com produtos capilares e criar conteúdos relevantes.",
  privacyAccepted: true,
  website: "",
};

const original = {
  url: process.env["SUPABASE_URL"],
  key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  password: process.env["AFFILIATE_ADMIN_PASSWORD"],
  resend: process.env["RESEND_API_KEY"],
  from: process.env["AFFILIATE_FROM_EMAIL"],
};
beforeEach(() => {
  process.env["SUPABASE_URL"] = "https://example.supabase.co";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "example-test-service-key";
  process.env["AFFILIATE_ADMIN_PASSWORD"] = "a-long-test-password-for-team";
  delete process.env["RESEND_API_KEY"];
  delete process.env["AFFILIATE_FROM_EMAIL"];
});
afterEach(() => {
  for (const [name, old] of Object.entries({
    SUPABASE_URL: original.url,
    SUPABASE_SERVICE_ROLE_KEY: original.key,
    AFFILIATE_ADMIN_PASSWORD: original.password,
    RESEND_API_KEY: original.resend,
    AFFILIATE_FROM_EMAIL: original.from,
  })) {
    if (old === undefined) delete process.env[name];
    else process.env[name] = old;
  }
  vi.unstubAllGlobals();
});

describe("Inscrição de afiliadas", () => {
  it("valida todos os campos e converte o e-mail para minúsculas", () => {
    const parsed = affiliateApplicationSchema.parse(valid);
    expect(parsed.email).toBe("maria@example.com");
    expect(parsed.fullName).toBe(valid.fullName);
  });
  it("rejeita menores, perfis falsos, motivação curta e ausência de consentimento", () => {
    expect(affiliateApplicationSchema.safeParse({ ...valid, age: 17 }).success).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({
        ...valid,
        instagram: "https://instagram.com.evil.com/maria",
      }).success,
    ).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({ ...valid, instagram: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({ ...valid, tiktok: "https://tiktok.com/watch?v=1" })
        .success,
    ).toBe(false);
    expect(affiliateApplicationSchema.safeParse({ ...valid, motivation: "Oi" }).success).toBe(
      false,
    );
    expect(affiliateApplicationSchema.safeParse({ ...valid, privacyAccepted: false }).success).toBe(
      false,
    );
    expect(affiliateApplicationSchema.safeParse({ ...valid, email: "" }).success).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({
        ...valid,
        instagram: "https://instagram.com/maria////",
      }).success,
    ).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({ ...valid, instagram: "https://instagram.com/p" })
        .success,
    ).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({ ...valid, instagram: "https://instagram.com/stories" })
        .success,
    ).toBe(false);
    expect(
      affiliateApplicationSchema.safeParse({ ...valid, tiktok: "https://tiktok.com//@maria" })
        .success,
    ).toBe(false);
  });
  it("salva no banco com status padrão e normaliza links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await createAffiliateApplication(affiliateApplicationSchema.parse(valid));
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/rest/v1/vonix_affiliate_applications");
    const payload = JSON.parse(init.body);
    expect(payload.email).toBe("maria@example.com");
    expect(payload.instagram_url).toBe("https://instagram.com/maria.cachos");
    expect(payload.tiktok_url).toBe("https://tiktok.com/@maria.cachos");
    expect(payload.status).toBeUndefined();
  });
  it("evita cadastro duplicado sem revelar se o endereço existe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "23505" }), { status: 409 })),
    );
    expect(await createAffiliateApplication(affiliateApplicationSchema.parse(valid))).toEqual({
      ok: true,
    });
  });
  it("honeypot não persiste dados de robôs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await createAffiliateApplication(
        affiliateApplicationSchema.parse({ ...valid, website: "spam.org" }),
      ),
    ).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Acesso e decisões", () => {
  it("exige uma senha administrativa configurada e suficientemente longa", () => {
    expect(affiliateAdminAuthorized("a-long-test-password-for-team")).toBe(true);
    expect(affiliateAdminAuthorized("senha-errada")).toBe(false);
    process.env["AFFILIATE_ADMIN_PASSWORD"] = "short";
    expect(affiliateAdminAuthorized("short")).toBe(false);
  });
  it("aplica a decisão por RPC atômica e aceita resultado falso quando já analisada", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", mock);
    const id = "00000000-0000-4000-8000-000000000000";
    expect(await decideAffiliateApplication(id, "aprovada")).toBe(true);
    expect(await decideAffiliateApplication(id, "aprovada")).toBe(false);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0]![0]).toContain("rpc/vonix_affiliate_decide");
  });
  it("busca e-mails completos com pontuação através de RPC parametrizada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 245,
          applications: [{ id: "a", full_name: "Maria" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          pendente: 245,
          aprovada: 12,
          recusada: 9,
          email_pendente: 8,
          email_processando: 2,
          email_enviado: 10,
          email_falhou: 1,
          email_incerto: 3,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await listAffiliateApplications({
      status: "pendente",
      page: 2,
      search: "maria.souza@example.com",
    });
    expect(result.total).toBe(245);
    expect(result.stats).toEqual({ pendente: 245, aprovada: 12, recusada: 9 });
    expect(result.mailStats).toEqual({
      pendente: 8,
      processando: 2,
      enviado: 10,
      falhou: 1,
      incerto: 3,
    });
    expect(fetchMock.mock.calls[0]![0]).toContain("rpc/vonix_affiliate_search");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({
      p_status: "pendente",
      p_query: "maria.souza@example.com",
      p_offset: 80,
      p_limit: 40,
      p_mail_status: null,
    });
  });

  it("filtra globalmente notificações incertas sem buscar dados de pendentes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 1,
          applications: [
            {
              id: "incerta-qa",
              status: "recusada",
              vonix_affiliate_mail_outbox: [{ status: "incerto", sent_at: null }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          pendente: 10,
          aprovada: 5,
          recusada: 3,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 5,
          email_falhou: 1,
          email_incerto: 1,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await listAffiliateApplications({
      status: "todas",
      page: 0,
      search: "",
      mailStatus: "incerto",
    });
    expect(response.total).toBe(1);
    expect(response.applications[0]?.status).toBe("recusada");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({
      p_status: "todas",
      p_query: "",
      p_offset: 0,
      p_limit: 40,
      p_mail_status: "incerto",
    });
  });
});

describe("Diagnóstico de preparação sem segredos", () => {
  it("mostra apenas indicadores e resultados de consultas de leitura", async () => {
    process.env["AFFILIATE_GOVERNANCE_MIGRATED"] = "false";
    const fake = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fake);
    const result = await affiliateOperationalReadiness();
    expect(result.recruitmentOpen).toBe(false);
    expect(result.checks.some((c) => c.id === "migration" && !c.ok)).toBe(true);
    expect(result.databaseResponding).toBe(true);
    expect(result.governanceResponding).toBe(true);
    const printed = JSON.stringify(result);
    expect(printed).not.toContain("example-test-service-key");
    expect(printed).not.toContain("a-long-test-password-for-team");
    expect(fake).toHaveBeenCalledTimes(2);
    delete process.env["AFFILIATE_GOVERNANCE_MIGRATED"];
  });
});

describe("Exclusão LGPD e prévia de retenção", () => {
  it("confirma o endereço e restringe os motivos, sem enviar PII ao retorno", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", mock);
    const uuid = "00000000-0000-4000-8000-000000000000";
    expect(
      await eraseAffiliateApplication(uuid, " MARIA@EXAMPLE.COM ", "solicitacao_titular"),
    ).toBe(true);
    const [url, req] = mock.mock.calls[0]!;
    expect(String(url)).toContain("/rpc/vonix_affiliate_erase");
    expect(JSON.parse(String(req.body))).toEqual({
      p_id: uuid,
      p_confirmation_email: "maria@example.com",
      p_reason: "solicitacao_titular",
    });
    expect(await eraseAffiliateApplication(uuid, "maria@example.com", "correcao")).toBe(false);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("não aceita motivos fora do catálogo nem e-mails inválidos", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    const uuid = "00000000-0000-4000-8000-000000000000";
    await expect(
      eraseAffiliateApplication(uuid, "wrong-email", "solicitacao_titular"),
    ).rejects.toThrow();
    await expect(
      eraseAffiliateApplication(uuid, "valid@example.com", "irrelevante" as "correcao"),
    ).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });

  it("retorna apenas totais estimados, sem executar exclusões", async () => {
    const mock = vi.fn().mockResolvedValue(
      Response.json({
        pending_eligible: 5,
        rejected_eligible: 9,
        executed_deletions: 0,
      }),
    );
    vi.stubGlobal("fetch", mock);
    expect(await previewAffiliateRetention(90, 180)).toEqual({
      pendingEligible: 5,
      rejectedEligible: 9,
      executedDeletions: 0,
    });
    expect(JSON.parse(String(mock.mock.calls[0]![1].body))).toEqual({
      p_pending_days: 90,
      p_rejected_days: 180,
    });
    await expect(previewAffiliateRetention(2, 180)).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe("Notificações", () => {
  it("mantém assuntos e mensagens para aprovação e recusa", () => {
    const approved = affiliateDecisionEmail("aprovada");
    const rejected = affiliateDecisionEmail("recusada");
    expect(approved.subject).toBe("Parabéns! Você foi aprovada na Vonix Hair!");
    expect(approved.text).toContain("ganhar comissões pelas suas vendas");
    expect(rejected.subject).toBe("Resultado da sua inscrição | Vonix Hair");
    expect(rejected.text).toContain("não foi possível aprovar sua inscrição");
  });
  it("não reclama notificações nem faz envios sem provedor configurado", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await processAffiliateEmails(1)).toEqual({ sent: 0, failed: 0, configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("usa a chave estável de idempotência e marca sucesso somente após confirmação", async () => {
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["AFFILIATE_FROM_EMAIL"] = "Vonix Hair <afiliados@example.com>";
    const calls: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      calls.push(url);
      if (url.includes("claim_mail"))
        return Promise.resolve(
          Response.json([
            {
              mail_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              recipient: "maria@example.com",
              decision: "aprovada",
              attempt: 1,
            },
          ]),
        );
      if (url.includes("finish_mail")) return Promise.resolve(Response.json(true));
      if (url === "https://api.resend.com/emails") {
        expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
          "vonix-afiliada-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        );
        const payload = JSON.parse(String(init.body));
        expect(payload.to).toEqual(["maria@example.com"]);
        expect(payload.subject).toContain("aprovada");
        return Promise.resolve(Response.json({ id: "resend-id-1" }));
      }
      throw new Error("Unexpected url: " + url);
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await processAffiliateEmails(1)).toEqual({ sent: 1, failed: 0, configured: true });
    expect(calls).toEqual([
      "https://example.supabase.co/rest/v1/rpc/vonix_affiliate_claim_mail",
      "https://api.resend.com/emails",
      "https://example.supabase.co/rest/v1/rpc/vonix_affiliate_finish_mail",
    ]);
    const finish = JSON.parse(String(fetchMock.mock.calls[2]![1].body));
    expect(finish.p_success).toBe(true);
    expect(finish.p_attempt).toBe(1);
    expect(finish.p_provider_id).toBe("resend-id-1");
  });
  it("não marca envio como realizado se o provedor retornar erro", async () => {
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["AFFILIATE_FROM_EMAIL"] = "Vonix Hair <afiliados@example.com>";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            mail_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            recipient: "maria@example.com",
            decision: "recusada",
            attempt: 2,
          },
        ]),
      )
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", fetchMock);
    expect(await processAffiliateEmails(1)).toEqual({ sent: 0, failed: 1, configured: true });
    expect(JSON.parse(String(fetchMock.mock.calls[2]![1].body)).p_success).toBe(false);
  });
});

describe("Tratamento de resultados ambíguos do Resend", () => {
  const claimed = {
    mail_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    recipient: "maria@example.com",
    decision: "aprovada",
    attempt: 1,
  };
  beforeEach(() => {
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["AFFILIATE_FROM_EMAIL"] = "Vonix Hair <afiliados@example.com>";
  });
  it("registra timeout como incerto; não como e-mail enviado", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([claimed]))
      .mockRejectedValueOnce(new Error("timeout após aceite"))
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await processAffiliateEmails(1)).toEqual({ sent: 0, failed: 1, configured: true });
    const finish = JSON.parse(String(mock.mock.calls[2]![1].body));
    expect(finish).toMatchObject({ p_success: false, p_unknown: true, p_permanent: false });
  });
  it("HTTP 409 de idempotência exige conciliação, sem reenviar automaticamente", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([claimed]))
      .mockResolvedValueOnce(new Response("conflicting idempotency", { status: 409 }))
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await processAffiliateEmails(1)).toMatchObject({ sent: 0, failed: 1 });
    const finish = JSON.parse(String(mock.mock.calls[2]![1].body));
    expect(finish).toMatchObject({ p_success: false, p_unknown: true, p_permanent: true });
  });
  it("erro 401 do provedor é falha definitiva, não timeout", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([claimed]))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await processAffiliateEmails(1)).toMatchObject({ sent: 0, failed: 1 });
    expect(JSON.parse(String(mock.mock.calls[2]![1].body))).toMatchObject({
      p_success: false,
      p_unknown: false,
      p_permanent: true,
    });
  });
  it("HTTP 200 sem identificador não pode ser classificado como entregue", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([claimed]))
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await processAffiliateEmails(1)).toMatchObject({ sent: 0, failed: 1 });
    expect(JSON.parse(String(mock.mock.calls[2]![1].body))).toMatchObject({
      p_success: false,
      p_unknown: true,
    });
  });
  it("não confirma sucesso se a persistência da conclusão falhar", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([claimed]))
      .mockResolvedValueOnce(Response.json({ id: "resend-real-id" }))
      .mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", mock);
    await expect(processAffiliateEmails(1)).rejects.toThrow(/claim changed/i);
  });
});
