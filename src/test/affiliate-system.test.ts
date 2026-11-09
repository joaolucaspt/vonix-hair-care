import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { affiliateApplicationSchema } from "@/lib/affiliate-application";
import { affiliateDecisionEmail } from "@/lib/affiliate-email";
import {
  affiliateAdminAuthorized,
  createAffiliateApplication,
  decideAffiliateApplication,
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
    expect(payload.instagram_url).toBe("https://www.instagram.com/maria.cachos");
    expect(payload.tiktok_url).toBe("https://www.tiktok.com/@maria.cachos");
    expect(payload.status).toBeUndefined();
  });
  it("evita cadastro duplicado sem sobrescrever a decisão anterior", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "23505" }), { status: 409 })),
    );
    expect(await createAffiliateApplication(affiliateApplicationSchema.parse(valid))).toEqual({
      ok: false,
      reason: "Esta inscrição já foi recebida.",
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
  it("paginação por status, busca e estatísticas sem carregar todas as candidatas", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "a", full_name: "Maria" }]), {
          status: 200,
          headers: { "content-range": "0-0/245" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ pendente: 245, aprovada: 12, recusada: 9 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await listAffiliateApplications({
      status: "pendente",
      page: 2,
      search: "Maria",
    });
    expect(result.total).toBe(245);
    expect(result.stats).toEqual({ pendente: 245, aprovada: 12, recusada: 9 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("offset=80");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("status=eq.pendente");
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
