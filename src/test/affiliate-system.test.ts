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

// Synthetic row with every documented field from the privileged search RPC.
const listedCandidate = {
  id: "00000000-0000-4000-8000-000000000123",
  full_name: "Maria de Teste",
  age: 27,
  city: "Belo Horizonte",
  state: "MG",
  hair_type: "Cacheado",
  email: "maria@example.invalid",
  instagram_url: "https://instagram.com/qa",
  tiktok_url: null,
  motivation: null,
  questionnaire_encrypted: null,
  status: "pendente",
  created_at: "2026-11-09T12:00:00Z",
  reviewed_at: null,
  vonix_affiliate_mail_outbox: [],
};

const original = {
  url: process.env["AFFILIATE_SUPABASE_URL"],
  ref: process.env["AFFILIATE_SUPABASE_PROJECT_REF"],
  key: process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"],
  password: process.env["AFFILIATE_ADMIN_PASSWORD"],
  resend: process.env["RESEND_API_KEY"],
  from: process.env["AFFILIATE_FROM_EMAIL"],
};
beforeEach(() => {
  process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
  process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
  process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "example-test-service-key";
  process.env["AFFILIATE_ADMIN_PASSWORD"] = "a-long-test-password-for-team";
  delete process.env["RESEND_API_KEY"];
  delete process.env["AFFILIATE_FROM_EMAIL"];
});
afterEach(() => {
  for (const [name, old] of Object.entries({
    AFFILIATE_SUPABASE_URL: original.url,
    AFFILIATE_SUPABASE_PROJECT_REF: original.ref,
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: original.key,
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
      vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "vonix_affiliate_applications_email_key"',
            details: "synthetic duplicate email",
          },
          { status: 409 },
        ),
      ),
    );
    expect(await createAffiliateApplication(affiliateApplicationSchema.parse(valid))).toEqual({
      ok: true,
    });
  });
  it("não considera perfil social já cadastrado como inscrição recebida", async () => {
    for (const constraint of [
      "vonix_affiliate_instagram_unique",
      "vonix_affiliate_tiktok_unique",
      "vonix_affiliate_mail_outbox_application_id_key",
    ]) {
      const mock = vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "23505",
            message: `duplicate key value violates unique constraint "${constraint}"`,
            details: "Synthetic prior applicant profile",
          },
          { status: 409 },
        ),
      );
      vi.stubGlobal("fetch", mock);
      await expect(
        createAffiliateApplication(affiliateApplicationSchema.parse(valid)),
      ).rejects.toThrow(/Falha ao salvar inscrição/);
      expect(mock).toHaveBeenCalledOnce();
    }
  });

  it("não presume duplicidade do e-mail sem prova da restrição exata", async () => {
    for (const body of [
      { code: "23505" },
      { code: "23505", message: "duplicate key value violates unique constraint unknown" },
      {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "vonix_affiliate_applications_email_key_extra"',
      },
    ]) {
      const mock = vi.fn().mockResolvedValue(Response.json(body, { status: 409 }));
      vi.stubGlobal("fetch", mock);
      await expect(
        createAffiliateApplication(affiliateApplicationSchema.parse(valid)),
      ).rejects.toThrow(/Falha ao salvar inscrição/);
    }
  });

  it("não confunde conflitos SQL diferentes de duplicidade com cadastro recebido", async () => {
    for (const body of [
      { code: "23503", message: "synthetic foreign key failure" },
      { code: "23514", message: "synthetic constraint failure" },
      { code: "PGRST204", message: "synthetic schema conflict" },
      { message: "conflict without SQLSTATE" },
    ]) {
      const mock = vi.fn().mockResolvedValue(Response.json(body, { status: 409 }));
      vi.stubGlobal("fetch", mock);
      await expect(
        createAffiliateApplication(affiliateApplicationSchema.parse(valid)),
      ).rejects.toThrow(/Falha ao salvar inscrição/);
      expect(mock).toHaveBeenCalledOnce();
    }
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
          applications: [listedCandidate],
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

  it("projects only approved triage fields, even if the privileged RPC returns extra PII", async () => {
    const raw = {
      ...listedCandidate,
      cpf: "SENSITIVE_CPF_NOT_FOR_BROWSER",
      mailing_address: "SENSITIVE_HOME_NOT_FOR_BROWSER",
      questionnaire_encrypted: "SENSITIVE_CIPHERTEXT_NOT_FOR_BROWSER",
      private_bank_token: "SENSITIVE_TOKEN_NOT_FOR_BROWSER",
      vonix_affiliate_mail_outbox: [
        {
          status: "incerto",
          sent_at: null,
          provider_id: "SENSITIVE_PROVIDER_ID_NOT_FOR_BROWSER",
          recipient: "SENSITIVE_RECIPIENT_NOT_FOR_BROWSER",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ total: 1, applications: [raw] }))
      .mockResolvedValueOnce(
        Response.json({
          pendente: 1,
          aprovada: 0,
          recusada: 0,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 0,
          email_falhou: 0,
          email_incerto: 1,
          secret_server_field: "SENSITIVE_STATS_NOT_FOR_BROWSER",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await listAffiliateApplications({ status: "pendente", page: 0 });
    expect(response.applications).toHaveLength(1);
    expect(response.applications[0]?.email).toBe(listedCandidate.email);
    expect(response.applications[0]?.vonix_affiliate_mail_outbox).toEqual([
      { status: "incerto", sent_at: null },
    ]);
    expect(Object.keys(response.applications[0]!)).not.toContain("questionnaire_encrypted");
    const serialized = JSON.stringify(response);
    for (const sensitive of [
      "SENSITIVE_CPF_NOT_FOR_BROWSER",
      "SENSITIVE_HOME_NOT_FOR_BROWSER",
      "SENSITIVE_CIPHERTEXT_NOT_FOR_BROWSER",
      "SENSITIVE_TOKEN_NOT_FOR_BROWSER",
      "SENSITIVE_PROVIDER_ID_NOT_FOR_BROWSER",
      "SENSITIVE_RECIPIENT_NOT_FOR_BROWSER",
      "SENSITIVE_STATS_NOT_FOR_BROWSER",
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it("rejects oversized or malformed pages returned by privileged search RPC", async () => {
    const counters = {
      pendente: 45,
      aprovada: 0,
      recusada: 0,
      email_pendente: 0,
      email_processando: 0,
      email_enviado: 0,
      email_falhou: 0,
      email_incerto: 0,
    };
    for (const rows of [
      Array.from({ length: 41 }, (_, i) => ({
        ...listedCandidate,
        id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
      })),
      [{ ...listedCandidate, created_at: "not-a-timestamp" }],
      [{ ...listedCandidate, reviewed_at: "yesterday" }],
    ]) {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ total: 45, applications: rows }))
        .mockResolvedValueOnce(Response.json(counters));
      vi.stubGlobal("fetch", mock);
      await expect(listAffiliateApplications({ status: "pendente", page: 0 })).rejects.toThrow();
      expect(mock).toHaveBeenCalledTimes(2);
    }
  });

  it("recusa relação de e-mails duplicada ou datas inválidas no retorno privado", async () => {
    const validMail = { status: "enviado", sent_at: "2026-11-09T14:00:00.123456+00:00" };
    const counters = {
      pendente: 1,
      aprovada: 0,
      recusada: 0,
      email_pendente: 0,
      email_processando: 0,
      email_enviado: 1,
      email_falhou: 0,
      email_incerto: 0,
    };
    for (const mail of [
      [validMail, validMail],
      [{ status: "enviado", sent_at: "not-a-real-date" }],
      [{ status: "enviado", sent_at: "2026-11-09" }],
    ]) {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            total: 1,
            applications: [{ ...listedCandidate, vonix_affiliate_mail_outbox: mail }],
          }),
        )
        .mockResolvedValueOnce(Response.json(counters));
      vi.stubGlobal("fetch", mock);
      await expect(listAffiliateApplications({ status: "pendente", page: 0 })).rejects.toThrow();
      expect(mock).toHaveBeenCalledTimes(2);
    }
    const valid = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 1,
          applications: [{ ...listedCandidate, vonix_affiliate_mail_outbox: [validMail] }],
        }),
      )
      .mockResolvedValueOnce(Response.json(counters));
    vi.stubGlobal("fetch", valid);
    const result = await listAffiliateApplications({ status: "pendente", page: 0 });
    expect(result.applications[0]?.vonix_affiliate_mail_outbox).toEqual([validMail]);
  });

  it("fails closed when privileged search returns excessive encrypted questionnaire payload", async () => {
    const ciphertext = "v2." + "A".repeat(40000);
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 1,
          applications: [{ ...listedCandidate, questionnaire_encrypted: ciphertext }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          pendente: 1,
          aprovada: 0,
          recusada: 0,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 0,
          email_falhou: 0,
          email_incerto: 0,
        }),
      );
    vi.stubGlobal("fetch", mock);
    await expect(listAffiliateApplications({ status: "pendente", page: 0 })).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("accepts a full bounded page with valid PostgreSQL timestamp offsets", async () => {
    const fullPage = Array.from({ length: 40 }, (_, i) => ({
      ...listedCandidate,
      id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
      created_at: "2026-11-09T12:00:00.123456+00:00",
      reviewed_at: "2026-11-09T13:00:00.123456+00:00",
    }));
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ total: 40, applications: fullPage }))
      .mockResolvedValueOnce(
        Response.json({
          pendente: 40,
          aprovada: 0,
          recusada: 0,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 0,
          email_falhou: 0,
          email_incerto: 0,
        }),
      );
    vi.stubGlobal("fetch", mock);
    const result = await listAffiliateApplications({ status: "pendente", page: 0 });
    expect(result.applications).toHaveLength(40);
    expect(result.total).toBe(40);
  });

  it("fails closed on malformed applicant rows rather than exposing arbitrary RPC objects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 1,
          applications: [{ ...listedCandidate, age: "not-an-age", cpf: "should-not-pass" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          pendente: 1,
          aprovada: 0,
          recusada: 0,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 0,
          email_falhou: 0,
          email_incerto: 0,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAffiliateApplications({ status: "pendente", page: 0 })).rejects.toThrow();
  });

  it("rejects non-finite and missing database counters rather than showing incorrect figures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ total: 1, applications: [listedCandidate] }))
      .mockResolvedValueOnce(Response.json({ pendente: "invalid", aprovada: 0, recusada: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAffiliateApplications({ status: "pendente", page: 0 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("filtra globalmente notificações incertas sem buscar dados de pendentes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          total: 1,
          applications: [
            {
              ...listedCandidate,
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
    const fake = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          String(url).includes("retention_preview")
            ? { pending_eligible: 0, rejected_eligible: 0 }
            : {
                pendente: 0,
                aprovada: 0,
                recusada: 0,
                email_pendente: 0,
                email_processando: 0,
                email_enviado: 0,
                email_falhou: 0,
                email_incerto: 0,
              },
        ),
      ),
    );
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

  it("não confunde HTTP 200 com RPC saudável quando o formato de retorno é incorreto", async () => {
    const fake = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            String(url).includes("retention_preview")
              ? { pending_eligible: 0, rejected_eligible: 0 }
              : { error: "not-a-valid-stats-payload" },
          ),
        ),
      );
    vi.stubGlobal("fetch", fake);
    const readiness = await affiliateOperationalReadiness();
    expect(readiness.databaseResponding).toBe(false);
    expect(readiness.governanceResponding).toBe(true);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(readiness)).not.toContain("not-a-valid-stats-payload");
  });

  it("avalia a disponibilidade dos dois RPCs de modo independente", async () => {
    const fake = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("retention_preview")) {
        return Promise.reject(new Error("synthetic-network-error"));
      }
      return Promise.resolve(
        Response.json({
          pendente: 3,
          aprovada: 0,
          recusada: 0,
          email_pendente: 0,
          email_processando: 0,
          email_enviado: 0,
          email_falhou: 0,
          email_incerto: 0,
        }),
      );
    });
    vi.stubGlobal("fetch", fake);
    const readiness = await affiliateOperationalReadiness();
    expect(readiness.databaseResponding).toBe(true);
    expect(readiness.governanceResponding).toBe(false);
    expect(JSON.stringify(readiness)).not.toContain("synthetic-network-error");
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

  it("recusa contadores LGPD inválidos sem inventar números ou executar exclusões", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ pending_eligible: "five", rejected_eligible: 9 }))
      .mockResolvedValueOnce(Response.json({ pending_eligible: -1, rejected_eligible: 9 }))
      .mockResolvedValueOnce(Response.json({ pending_eligible: 5 }));
    vi.stubGlobal("fetch", mock);
    await expect(previewAffiliateRetention(90, 180)).rejects.toThrow();
    await expect(previewAffiliateRetention(90, 180)).rejects.toThrow();
    await expect(previewAffiliateRetention(90, 180)).rejects.toThrow();
    expect(mock.mock.calls.every(([url]) => String(url).includes("retention_preview"))).toBe(true);
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
      "https://abcdefghijklmnopqrst.supabase.co/rest/v1/rpc/vonix_affiliate_claim_mail",
      "https://api.resend.com/emails",
      "https://abcdefghijklmnopqrst.supabase.co/rest/v1/rpc/vonix_affiliate_finish_mail",
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

describe("Validação da fila privada antes de enviar comunicações", () => {
  const validClaim = {
    mail_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    recipient: "maria@example.com",
    decision: "aprovada",
    attempt: 1,
  };
  beforeEach(() => {
    process.env["RESEND_API_KEY"] = "synthetic-resend-test-key";
    process.env["AFFILIATE_FROM_EMAIL"] = "afiliadas@example.invalid";
  });

  it("não envia e-mails quando o RPC retorna destinatário, identificador ou tipo inválido", async () => {
    for (const malformed of [
      { ...validClaim, recipient: "not-an-email" },
      { ...validClaim, decision: "desconhecida" },
      { ...validClaim, mail_id: "../invalid-mail-id" },
      { ...validClaim, attempt: 0 },
      { ...validClaim, attempt: "1" },
    ]) {
      const mock = vi.fn().mockResolvedValue(Response.json([malformed]));
      vi.stubGlobal("fetch", mock);
      await expect(processAffiliateEmails(1)).rejects.toThrow();
      expect(mock).toHaveBeenCalledOnce();
      expect(String(mock.mock.calls[0]![0])).toContain("claim_mail");
    }
  });

  it("recusa um retorno do RPC não limitado a uma única notificação reservada", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json([validClaim, validClaim]));
    vi.stubGlobal("fetch", mock);
    await expect(processAffiliateEmails(1)).rejects.toThrow();
    expect(mock).toHaveBeenCalledOnce();
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
  it("does not record a successful email for blank, oversized or control-character provider receipts", async () => {
    process.env["RESEND_API_KEY"] = "synthetic-api-test-key";
    process.env["AFFILIATE_FROM_EMAIL"] = "afiliadas@example.invalid";
    const claimed = {
      mail_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      application_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      recipient: "maria@example.com",
      decision: "aprovada",
      attempt: 1,
    };
    for (const providerId of ["   ", "x".repeat(2048), "id\nheader"]) {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(Response.json([claimed]))
        .mockResolvedValueOnce(Response.json({ id: providerId }))
        .mockResolvedValueOnce(Response.json(true));
      vi.stubGlobal("fetch", mock);
      const result = await processAffiliateEmails(1);
      expect(result).toMatchObject({ sent: 0, failed: 1, configured: true });
      const finish = JSON.parse(String(mock.mock.calls[2]![1].body));
      expect(finish).toMatchObject({
        p_success: false,
        p_unknown: true,
        p_provider_id: null,
      });
      expect(mock).toHaveBeenCalledTimes(3);
    }
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
