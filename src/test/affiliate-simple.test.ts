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

  it("accepts a browser-issued 192-bit receipt while keeping it out of encrypted candidate data", async () => {
    const privateCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const record: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        record.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(null, { status: 201 });
      }),
    );
    const candidate = affiliateSimpleSchema.parse({ ...valid, trackingCode: privateCode });
    expect(await createSimpleAffiliateApplication(candidate)).toEqual({
      ok: true,
      trackingCode: privateCode,
    });
    expect(record).toHaveLength(1);
    expect(record[0]?.["status_token_hash"]).toBe(
      createHash("sha256").update(privateCode).digest("hex"),
    );
    expect(JSON.stringify(record)).not.toContain(privateCode);
    const restored = decryptAffiliateWizardForAdmin(String(record[0]?.["questionnaire_encrypted"]));
    expect(restored?.kind).toBe("simple");
    expect(restored?.answers.phone).toBe(valid.phone);
    expect(JSON.stringify(restored)).not.toContain(privateCode);
  });

  it("retries an already-committed enrollment with the same code after a lost HTTP response", async () => {
    const privateCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const candidate = affiliateSimpleSchema.parse({ ...valid, trackingCode: privateCode });
    let stored: Record<string, unknown> | null = null;
    let postCount = 0;
    let getCount = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postCount++;
        if (postCount === 1) {
          stored = JSON.parse(String(init.body)) as Record<string, unknown>;
          throw new TypeError("response disappeared after database committed");
        }
        expect(JSON.parse(String(init.body))).toMatchObject({
          status_token_hash: stored?.["status_token_hash"],
        });
        return Response.json({ code: "23505" }, { status: 409 });
      }
      getCount++;
      expect(String(url)).toContain("status_token_hash=eq.");
      expect(String(url)).not.toContain(privateCode);
      return Response.json([
        {
          instagram_url: stored?.["instagram_url"],
          status_token_hash: stored?.["status_token_hash"],
          questionnaire_encrypted: stored?.["questionnaire_encrypted"],
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(createSimpleAffiliateApplication(candidate)).rejects.toThrow(
      "response disappeared",
    );
    expect(await createSimpleAffiliateApplication(candidate)).toEqual({
      ok: true,
      trackingCode: privateCode,
    });
    expect(postCount).toBe(2);
    expect(getCount).toBe(1);
  });

  it("does not confirm a modified phone or address as a saved idempotent replay", async () => {
    const privateCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const oldForm = affiliateSimpleSchema.parse({ ...valid, trackingCode: privateCode });
    const previous: Record<string, unknown> = {
      instagram_url: "https://instagram.com/maria.exemplo",
      status_token_hash: createHash("sha256").update(privateCode).digest("hex"),
      questionnaire_encrypted: encryptSimpleAffiliateApplication(oldForm),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Response.json({ code: "23505" }, { status: 409 });
        }
        return Response.json([
          {
            instagram_url: previous?.["instagram_url"],
            status_token_hash: previous?.["status_token_hash"],
            questionnaire_encrypted: previous?.["questionnaire_encrypted"],
          },
        ]);
      }),
    );
    const current = affiliateSimpleSchema.parse({ ...oldForm, phone: "(31) 98888-9999" });
    expect(await createSimpleAffiliateApplication(current)).toMatchObject({ ok: false });
    expect(await createSimpleAffiliateApplication(oldForm)).toEqual({
      ok: true,
      trackingCode: privateCode,
    });
  });

  it("never treats someone else's Instagram collision as ownership of the private code", async () => {
    const privateCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push(String(url));
        if (init?.method === "POST") return Response.json({ code: "23505" }, { status: 409 });
        return Response.json([]);
      }),
    );
    expect(
      await createSimpleAffiliateApplication(
        affiliateSimpleSchema.parse({ ...valid, trackingCode: privateCode }),
      ),
    ).toMatchObject({ ok: false });
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests)).not.toContain(privateCode);
    expect(
      affiliateSimpleSchema.safeParse({ ...valid, trackingCode: "A".repeat(31) }).success,
    ).toBe(false);
  });

  it("same-code parallel requests return one private receipt without extra records", async () => {
    const privateCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const candidate = affiliateSimpleSchema.parse({ ...valid, trackingCode: privateCode });
    let accepted: Record<string, unknown> | null = null;
    let postCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          postCount++;
          if (postCount === 1) {
            accepted = JSON.parse(String(init.body)) as Record<string, unknown>;
            return new Response(null, { status: 201 });
          }
          return Response.json({ code: "23505" }, { status: 409 });
        }
        return Response.json([
          {
            instagram_url: accepted?.["instagram_url"],
            status_token_hash: accepted?.["status_token_hash"],
            questionnaire_encrypted: accepted?.["questionnaire_encrypted"],
          },
        ]);
      }),
    );
    const [first, second] = await Promise.all([
      createSimpleAffiliateApplication(candidate),
      createSimpleAffiliateApplication(candidate),
    ]);
    expect(first).toEqual({ ok: true, trackingCode: privateCode });
    expect(second).toEqual({ ok: true, trackingCode: privateCode });
    expect(postCount).toBe(2);
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

it("rejects newline/tab control characters in phones that the protected WhatsApp link cannot safely use", () => {
  for (const phone of ["(31)\n99999-9999", "(31)\t99999-9999", "(31) 99999\r-9999"]) {
    expect(
      affiliateSimpleSchema.safeParse({ ...valid, phone }).success,
      phone.replace(/\s/g, "_"),
    ).toBe(false);
  }
  expect(affiliateSimpleSchema.safeParse({ ...valid, phone: "(31) 99999-9999" }).success).toBe(
    true,
  );
  expect(affiliateSimpleSchema.safeParse({ ...valid, phone: "+55 (31) 99999 9999" }).success).toBe(
    true,
  );
});
