import { createDecipheriv } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  affiliateWizardSchema,
  ageFromBirthDate,
  validCpf,
  validCnpj,
  stepErrors,
  buildAffiliatePayload,
  WIZARD_STEPS,
  PREFERRED_VONIX_LINES,
  type AffiliateWizardDraft,
} from "@/lib/affiliate-wizard";
import {
  affiliateQuestionnaireEncryptionReady,
  encryptAffiliateWizard,
  affiliateWizardSummary,
} from "@/lib/affiliate-wizard-crypto.server";
import { affiliateApplicationSchema } from "@/lib/affiliate-application";
import {
  createAffiliateApplication,
  listAffiliateApplications,
} from "@/lib/affiliate-applications.server";

const fixture = {
  firstName: "Marina",
  lastName: "Exemplo",
  phone: "(31) 99999-9999",
  email: "marina@example.com",
  emailConfirmation: "marina@example.com",
  cpf: "529.982.247-25",
  cnpj: "",
  birthDate: "1998-09-14",
  birthCity: "Belo Horizonte",
  postalCode: "30110-012",
  city: "Belo Horizonte",
  state: "MG",
  street: "Rua da Bahia",
  district: "Centro",
  number: "150",
  complement: "Sala 2",
  instagramUsername: "@marina.exemplo",
  tiktokUsername: "",
  xUsername: "",
  youtubeUsername: "",
  niche: "Lifestyle",
  otherNiche: "",
  instagramFollowers: "De 1.001 a 2.000 seguidores",
  tiktokFollowers: "Não utilizo TikTok",
  municipalRegistration: "nao",
  municipalNumber: "",
  dependents: "Não tenho",
  preferredLine: "Botox Vonix",
  couponSuggestion: "MARINA10",
  hairType: "Cacheado",
  termsAccepted: true,
} satisfies AffiliateWizardDraft;

const original = {
  secret: process.env["AFFILIATE_QUESTIONNAIRE_KEY"],
  url: process.env["AFFILIATE_SUPABASE_URL"],
  ref: process.env["AFFILIATE_SUPABASE_PROJECT_REF"],
  key: process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"],
};
beforeEach(() => {
  process.env["AFFILIATE_QUESTIONNAIRE_KEY"] = Buffer.from(
    "0123456789abcdef0123456789abcdef",
    "utf8",
  ).toString("base64url");
  process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
  process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
  process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "fake-unit-test-service-role";
});
afterEach(() => {
  for (const [key, value] of Object.entries({
    AFFILIATE_QUESTIONNAIRE_KEY: original.secret,
    AFFILIATE_SUPABASE_URL: original.url,
    AFFILIATE_SUPABASE_PROJECT_REF: original.ref,
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: original.key,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe("Nuala-inspired Vonix five-stage form (reference field inventory)", () => {
  it("has exactly five stages and uses real Vonix catalogue lines", () => {
    expect(WIZARD_STEPS).toHaveLength(5);
    expect(PREFERRED_VONIX_LINES).toContain("Botox Vonix");
    expect(PREFERRED_VONIX_LINES).toContain("Progressiva Fio de Luz");
    expect(PREFERRED_VONIX_LINES.join(" ")).not.toContain("Nuala");
  });
  it("validates a full profile, deriving normalized data rather than asking for age twice", () => {
    const wizard = affiliateWizardSchema.parse(fixture);
    expect(ageFromBirthDate("1998-09-14", new Date("2026-11-09T12:00:00Z"))).toBe(28);
    const submitted = affiliateApplicationSchema.parse(buildAffiliatePayload(wizard));
    expect(submitted.fullName).toBe("Marina Exemplo");
    expect(submitted.instagram).toBe("https://www.instagram.com/marina.exemplo");
    expect(submitted.tiktok).toBe("");
    expect(submitted.wizard?.couponSuggestion).toBe("MARINA10");
  });
  it("uses the Brazilian calendar day for the legal 18-year age boundary", () => {
    const born = "2008-11-09";
    // UTC already says November 9 while São Paulo is still on November 8.
    expect(ageFromBirthDate(born, new Date("2026-11-09T02:59:59Z"))).toBe(17);
    expect(ageFromBirthDate(born, new Date("2026-11-09T03:00:00Z"))).toBe(18);
    expect(ageFromBirthDate("2008-11-10", new Date("2026-11-09T23:00:00Z"))).toBe(17);
  });

  it("rejects invalid Brazilian documents and implausible birthdates", () => {
    expect(validCpf(fixture.cpf)).toBe(true);
    expect(validCpf("111.111.111-11")).toBe(false);
    expect(validCpf("123.456.789-00")).toBe(false);
    expect(validCnpj("11.222.333/0001-81")).toBe(true);
    expect(validCnpj("11.222.333/0001-00")).toBe(false);
    expect(affiliateWizardSchema.safeParse({ ...fixture, cpf: "000.000.000-00" }).success).toBe(
      false,
    );
    expect(affiliateWizardSchema.safeParse({ ...fixture, birthDate: "2012-01-01" }).success).toBe(
      false,
    );
    expect(affiliateWizardSchema.safeParse({ ...fixture, birthDate: "1998-02-30" }).success).toBe(
      false,
    );
  });
  it("enforces email confirmation and required conditional answers only when relevant", () => {
    expect(stepErrors(0, { ...fixture, emailConfirmation: "outro@example.com" })).toHaveProperty(
      "emailConfirmation",
    );
    // Email schemas trim input, so both the step and final submission must
    // compare those same normalized values (including case).
    expect(
      stepErrors(0, {
        ...fixture,
        email: " MARINA@EXAMPLE.COM ",
        emailConfirmation: "marina@example.com",
      }),
    ).not.toHaveProperty("emailConfirmation");
    expect(stepErrors(1, { ...fixture, niche: "Outro", otherNiche: "" })).toHaveProperty(
      "otherNiche",
    );
    expect(stepErrors(1, fixture)).not.toHaveProperty("otherNiche");
    expect(
      stepErrors(2, { ...fixture, municipalRegistration: "sim", municipalNumber: "" }),
    ).toHaveProperty("municipalNumber");
    expect(stepErrors(2, fixture)).not.toHaveProperty("municipalNumber");
    expect(stepErrors(4, { ...fixture, termsAccepted: false })).toHaveProperty("termsAccepted");
  });
  it("blocks invalid social usernames in step one instead of failing only at final submission", () => {
    for (const instagramUsername of ["@p", "reels", "@stories", "explore", "direct"]) {
      expect(stepErrors(0, { ...fixture, instagramUsername })).toHaveProperty("instagramUsername");
    }
    for (const tiktokUsername of [
      "@a",
      "@".concat("a".repeat(31)),
      "@incorrect+handle",
      "@user/name",
    ]) {
      expect(stepErrors(0, { ...fixture, tiktokUsername })).toHaveProperty("tiktokUsername");
    }
    expect(stepErrors(0, { ...fixture, instagramUsername: "@valid.creator" })).not.toHaveProperty(
      "instagramUsername",
    );
    expect(stepErrors(0, { ...fixture, tiktokUsername: "@valid.creator" })).not.toHaveProperty(
      "tiktokUsername",
    );
    // The maximum valid Instagram username remains usable with an @ prefix.
    expect(
      stepErrors(0, { ...fixture, instagramUsername: "@".concat("a".repeat(30)) }),
    ).not.toHaveProperty("instagramUsername");
    expect(
      stepErrors(0, { ...fixture, tiktokUsername: "@".concat("a".repeat(30)) }),
    ).not.toHaveProperty("tiktokUsername");
  });

  it("blocks coupon suggestions not ending in 10 and rejects unsupported product names", () => {
    expect(affiliateWizardSchema.safeParse({ ...fixture, couponSuggestion: "TESTE" }).success).toBe(
      false,
    );
    expect(
      affiliateWizardSchema.safeParse({ ...fixture, preferredLine: "Linha Nuala" }).success,
    ).toBe(false);
  });
});

describe("Private encrypted questionnaire storage", () => {
  it("requires a 256-bit encryption key, never a short password", () => {
    expect(affiliateQuestionnaireEncryptionReady()).toBe(true);
    process.env["AFFILIATE_QUESTIONNAIRE_KEY"] = "short";
    expect(affiliateQuestionnaireEncryptionReady()).toBe(false);
    expect(() => encryptAffiliateWizard(affiliateWizardSchema.parse(fixture))).toThrow();
  });
  it("does not persist inapplicable conditional answers in encrypted questionnaires", () => {
    const sensitive = affiliateWizardSchema.parse({
      ...fixture,
      otherNiche: "STALE-NICHE-SYNTHETIC-PII",
      municipalNumber: "STALE-MUNICIPAL-SYNTHETIC-PII",
    });
    const packed = encryptAffiliateWizard(sensitive);
    const [, iv64, tag64, encrypted64] = packed.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env["AFFILIATE_QUESTIONNAIRE_KEY"]!, "base64url"),
      Buffer.from(iv64!, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag64!, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted64!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted);
    expect(parsed.answers.niche).toBe("Lifestyle");
    expect(parsed.answers.municipalRegistration).toBe("nao");
    expect(parsed.answers.otherNiche).toBe("");
    expect(parsed.answers.municipalNumber).toBe("");
    expect(decrypted).not.toContain("STALE-NICHE-SYNTHETIC-PII");
    expect(decrypted).not.toContain("STALE-MUNICIPAL-SYNTHETIC-PII");
    expect(affiliateWizardSummary(packed)?.preferredLine).toBe("Botox Vonix");
  });

  it("encrypts PII with authentication and returns only business-relevant summary", () => {
    const packed = encryptAffiliateWizard(affiliateWizardSchema.parse(fixture));
    expect(packed).toMatch(/^v2\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(packed).not.toContain("52998224725");
    expect(packed).not.toContain("Rua da Bahia");
    expect(affiliateWizardSummary(packed)).toMatchObject({
      niche: "Lifestyle",
      preferredLine: "Botox Vonix",
      couponSuggestion: "MARINA10",
      dependents: "Não tenho",
    });
    const parts = packed.split(".");
    const tag = parts[2]!;
    parts[2] = (tag.startsWith("A") ? "B" : "A") + tag.slice(1);
    expect(affiliateWizardSummary(parts.join("."))).toBeNull();
  });
  it("never leaks encrypted payload in admin JSON and derives identity from validated answers", async () => {
    const wizard = affiliateWizardSchema.parse(fixture);
    const payload = affiliateApplicationSchema.parse(buildAffiliatePayload(wizard));
    const mock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", mock);
    expect(await createAffiliateApplication(payload)).toEqual({ ok: true });
    const body = JSON.parse(String(mock.mock.calls[0]![1].body));
    expect(body.full_name).toBe("Marina Exemplo");
    expect(body.age).toBe(ageFromBirthDate(wizard.birthDate));
    expect(body.tiktok_url).toBeNull();
    expect(body.questionnaire_encrypted).toMatch(/^v2\./);
    expect(JSON.stringify(body)).not.toContain(wizard.cpf);
    expect(JSON.stringify(body)).not.toContain(wizard.street);
    const rows = [
      {
        ...body,
        id: "00000000-0000-4000-8000-000000000321",
        status: "pendente",
        created_at: new Date().toISOString(),
        reviewed_at: null,
      },
    ];
    const db = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ total: 1, applications: rows }))
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
    vi.stubGlobal("fetch", db);
    const result = await listAffiliateApplications({ status: "pendente", page: 0 });
    expect(result.applications[0]?.questionnaireSummary?.preferredLine).toBe("Botox Vonix");
    expect(JSON.stringify(result)).not.toContain(body.questionnaire_encrypted);
    expect(JSON.stringify(result)).not.toContain(wizard.cpf);
    expect(JSON.stringify(result)).not.toContain(wizard.street);
  });
});
