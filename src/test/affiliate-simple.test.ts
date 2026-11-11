import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { affiliateSimpleSchema } from "@/lib/affiliate-simple";
import {
  encryptSimpleAffiliateApplication,
  affiliateWizardSummary,
  decryptAffiliateWizardForAdmin,
} from "@/lib/affiliate-wizard-crypto.server";
import {
  createSimpleAffiliateApplication,
  getAffiliateStatusWithCode,
} from "@/lib/affiliate-applications.server";
import { createHash } from "node:crypto";

const valid = {
  fullName: "Maria da Silva",
  phone: "(31) 99999-9999",
  postalCode: "30110-012",
  street: "Rua da Bahia",
  number: "150",
  district: "Centro",
  city: "Belo Horizonte",
  state: "MG",
  complement: "Apto 2",
  instagram: "maria.exemplo",
  instagramFollowers: 12345,
  tiktok: "maria.exemplo",
  tiktokFollowers: 4300,
  privacyAccepted: true,
  website: "",
} as const;

const envKeys = [
  "AFFILIATE_QUESTIONNAIRE_KEY",
  "AFFILIATE_SUPABASE_URL",
  "AFFILIATE_SUPABASE_PROJECT_REF",
  "AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  process.env["AFFILIATE_QUESTIONNAIRE_KEY"] = Buffer.from(
    "0123456789abcdef0123456789abcdef",
    "utf8",
  ).toString("base64url");
  process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
  process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
  process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "synthetic-test-service-role";
  delete process.env["SUPABASE_URL"];
  delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
});
afterEach(() => {
  for (const key of envKeys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe("short Vonix affiliate form and compatible encrypted storage", () => {
  it("accepts exactly the requested fields plus required consent and bot trap", () => {
    expect(affiliateSimpleSchema.parse(valid).instagramFollowers).toBe(12345);
    for (const key of ["email", "age", "cpf", "hairType", "motivation", "wizard", "birthDate"]) {
      expect(affiliateSimpleSchema.safeParse({ ...valid, [key]: "hidden" }).success).toBe(false);
    }
  });

  it("requires address, phone and Instagram, while validating provided TikTok data", () => {
    const failures = [
      { postalCode: "30110" },
      { number: "" },
      { street: "" },
      { district: "" },
      { city: "" },
      { state: "" },
      { phone: "invalid" },
      { instagram: "https://evil.invalid/maria" },
      { tiktok: "a" },
      { instagramFollowers: -1 },
      { tiktokFollowers: 1.5 },
      { fullName: "Maria" },
      { privacyAccepted: false },
    ];
    for (const change of failures) {
      expect(
        affiliateSimpleSchema.safeParse({ ...valid, ...change }).success,
        JSON.stringify(change),
      ).toBe(false);
    }
  });

  it("accepts genuine Brazilian addresses without a numbered building, but not random text", () => {
    for (const number of ["s/n", "SN", "sem número", "sem numero", "123", "123A"]) {
      const result = affiliateSimpleSchema.safeParse({ ...valid, number });
      expect(result.success, number).toBe(true);
    }
    for (const number of ["", "nada", "???", "<script>", "123?"]) {
      expect(affiliateSimpleSchema.safeParse({ ...valid, number }).success, number).toBe(false);
    }
  });

  it("accepts no TikTok account or count, while preserving encrypted moderation details", () => {
    const absent = affiliateSimpleSchema.parse({ ...valid, tiktok: "", tiktokFollowers: null });
    expect(absent.tiktok).toBe("");
    expect(absent.tiktokFollowers).toBeNull();
    const omitted = { ...valid } as Record<string, unknown>;
    delete omitted["tiktok"];
    delete omitted["tiktokFollowers"];
    expect(affiliateSimpleSchema.parse(omitted)).toMatchObject({
      tiktok: "",
      tiktokFollowers: null,
    });
    expect(affiliateSimpleSchema.parse({ ...valid, tiktokFollowers: null }).tiktok).toBe(
      "maria.exemplo",
    );
    const encrypted = encryptSimpleAffiliateApplication(absent);
    expect(affiliateWizardSummary(encrypted)).toMatchObject({
      kind: "simple",
      instagramFollowers: "12.345",
      tiktokFollowers: "",
    });
    expect(decryptAffiliateWizardForAdmin(encrypted)?.answers).toMatchObject({
      tiktokUsername: "",
      tiktokFollowers: "",
    });
  });

  it("stores absent TikTok as SQL null, never as a malformed URL", async () => {
    const posted: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(null, { status: 201 });
      }),
    );
    const candidate = affiliateSimpleSchema.parse({ ...valid, tiktok: "", tiktokFollowers: null });
    expect(await createSimpleAffiliateApplication(candidate)).toMatchObject({
      ok: true,
      trackingCode: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    });
    expect(posted).toHaveLength(1);
    expect(posted[0]?.["tiktok_url"]).toBeNull();
    expect(String(posted[0]?.["questionnaire_encrypted"])).toMatch(/^v3\./);
  });

  it("retrieves only status and reason via hashed private code, never Instagram", async () => {
    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const expected = createHash("sha256").update(code).digest("hex");
    const mocked = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain("status_token_hash=eq." + expected);
      expect(String(url)).not.toContain(code);
      expect(String(url)).not.toContain("instagram");
      return new Response(
        JSON.stringify([
          {
            status: "recusada",
            rejection_reason: "seguidores_insuficientes",
            created_at: "2026-11-11T11:00:00Z",
            reviewed_at: "2026-11-11T12:00:00Z",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", mocked);
    expect(await getAffiliateStatusWithCode(code)).toMatchObject({
      status: "recusada",
      rejection_reason: "seguidores_insuficientes",
    });
    expect(mocked).toHaveBeenCalledOnce();
    await expect(getAffiliateStatusWithCode("instagram_public")).rejects.toThrow();
  });

  it("keeps phone/address private and exposes only follower counts in triage", () => {
    const checked = affiliateSimpleSchema.parse(valid);
    const cipher = encryptSimpleAffiliateApplication(checked);
    expect(cipher.startsWith("v3.")).toBe(true);
    for (const privateText of ["Rua da Bahia", "99999", "Apto 2", "30110-012"]) {
      expect(cipher).not.toContain(privateText);
    }
    const summary = affiliateWizardSummary(cipher);
    expect(summary).toMatchObject({
      kind: "simple",
      instagramFollowers: "12.345",
      tiktokFollowers: "4.300",
    });
    expect(JSON.stringify(summary)).not.toContain("Rua da Bahia");
    const detail = decryptAffiliateWizardForAdmin(cipher);
    expect(detail?.kind).toBe("simple");
    expect(detail?.answers).toMatchObject({
      firstName: "Maria da Silva",
      phone: "(31) 99999-9999",
      postalCode: "30110-012",
      number: "150",
      street: "Rua da Bahia",
      instagramFollowers: "12.345",
      tiktokFollowers: "4.300",
    });
    expect(detail?.answers.cpf).toBe("");
    expect(detail?.answers.email).toBe("");
  });

  it("inserts no fabricated age, email, CPF or hair type into the dedicated database", async () => {
    const posted: Record<string, unknown>[] = [];
    const mockedFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://abcdefghijklmnopqrst.supabase.co/rest/v1/vonix_affiliate_applications",
      );
      expect(init?.method).toBe("POST");
      posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", mockedFetch);
    const submitted = await createSimpleAffiliateApplication(affiliateSimpleSchema.parse(valid));
    expect(submitted).toMatchObject({
      ok: true,
      trackingCode: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    });
    expect(posted[0]?.["status_token_hash"]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(posted)).not.toContain(submitted.trackingCode);
    expect(posted).toHaveLength(1);
    for (const field of [
      "age",
      "email",
      "hair_type",
      "phone",
      "postal_code",
      "street",
      "number",
      "cpf",
      "motivation",
    ]) {
      expect(posted[0]).not.toHaveProperty(field);
    }
    expect(posted[0]).toMatchObject({
      full_name: "Maria da Silva",
      city: "Belo Horizonte",
      state: "MG",
      instagram_url: "https://instagram.com/maria.exemplo",
      tiktok_url: "https://tiktok.com/@maria.exemplo",
    });
    expect(String(posted[0]?.["questionnaire_encrypted"])).toMatch(/^v3\./);
  });

  it("rejects a unique social profile collision without confirming another person's identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 409 })),
    );
    const result = await createSimpleAffiliateApplication(affiliateSimpleSchema.parse(valid));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("maria.exemplo");
  });

  it("honeypot does not persist spam", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    expect(
      await createSimpleAffiliateApplication(
        affiliateSimpleSchema.parse({ ...valid, website: "https://spam.invalid" }),
      ),
    ).toEqual({ ok: true });
    expect(fetched).not.toHaveBeenCalled();
  });
});
