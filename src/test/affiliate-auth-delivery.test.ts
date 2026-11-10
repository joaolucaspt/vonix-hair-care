import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  config: vi.fn(),
  values: new Map<string, string>(),
}));
vi.mock("@/lib/affiliate-database.server", () => ({
  affiliateDatabaseConfig: deps.config,
}));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) => deps.values.get(key) || "",
}));

import {
  affiliateCustomAuthEmailReady,
  affiliateEmailAuthorizedForPortal,
  sendAffiliateAuthEmailWithResend,
} from "@/lib/affiliate-auth-delivery.server";

const base = "https://synthetic-reference-123.supabase.co";
const inbox = "candidate@example.invalid";
const success = () => Response.json({ id: "email_1234" });
const generate = () =>
  Response.json({
    action_link: base + "/auth/v1/verify?token=fake-token&type=magiclink",
    email_otp: "123456",
  });

beforeEach(() => {
  vi.unstubAllGlobals();
  deps.config.mockReset();
  deps.config.mockReturnValue({
    url: base,
    headers: { apikey: "test-private-only-not-real", "content-type": "application/json" },
  });
  deps.values.clear();
  deps.values.set("AFFILIATE_TRAFFIC_PEPPER", "x".repeat(50));
  deps.values.set("RESEND_API_KEY", "re_" + "T".repeat(36));
  deps.values.set("AFFILIATE_FROM_EMAIL", "Vonix Hair <acesso@vonixhair.com>");
});

describe("Verified Supabase Auth OTP via transactional email", () => {
  it("checks existence using a private DB lookup, without returning applicant details", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([{ email: inbox }]));
    vi.stubGlobal("fetch", fetcher);
    expect(await affiliateEmailAuthorizedForPortal(inbox, "applicant")).toBe(true);
    const url = fetcher.mock.calls[0]![0] as string;
    expect(url).toContain("vonix_affiliate_applications?select=email");
    expect(url).not.toContain("questionnaire_encrypted");
  });

  it("does not treat missing applicant data as an authorized email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    expect(await affiliateEmailAuthorizedForPortal(inbox, "applicant")).toBe(false);
  });

  it("sends only a generated OTP via Resend, without leaking token in the message", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(generate())
      .mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetcher);
    expect(await sendAffiliateAuthEmailWithResend(inbox, "applicant")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const [quotaUrl] = fetcher.mock.calls[0]!;
    expect(quotaUrl).toContain("rpc/vonix_affiliate_consume_auth_mail_cooldown");
    const [adminUrl, adminOptions] = fetcher.mock.calls[1]!;
    expect(adminUrl).toContain("/auth/v1/admin/generate_link");
    expect(JSON.parse(adminOptions.body)).toMatchObject({
      email: inbox,
      type: "magiclink",
      redirect_to: "https://vonixhair.com/acompanhar-inscricao",
    });
    const [deliveryUrl, deliveryOptions] = fetcher.mock.calls[2]!;
    expect(deliveryUrl).toBe("https://api.resend.com/emails");
    expect(deliveryOptions.redirect).toBe("manual");
    const message = JSON.parse(deliveryOptions.body);
    expect(message.to).toEqual([inbox]);
    expect(message.text).toContain("123456");
    expect(message.text).not.toContain("fake-token");
    expect(message.text).toContain("https://vonixhair.com/acompanhar-inscricao");
    expect(message.text).toContain("DIGITE o código");
    expect(message.text).toContain("Não reutilize links de convites anteriores");
  });

  it("does not forward a generated token to an untrusted host", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(
        Response.json({
          action_link: "https://untrusted.example/verify?token=secret",
          email_otp: "123456",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await sendAffiliateAuthEmailWithResend(inbox, "applicant")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops after a recipient's cooldown is exhausted", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", fetcher);
    expect(await sendAffiliateAuthEmailWithResend(inbox, "owner")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cannot create Auth identity when no transactional provider is configured", async () => {
    deps.values.delete("RESEND_API_KEY");
    vi.stubGlobal("fetch", vi.fn());
    expect(affiliateCustomAuthEmailReady()).toBe(false);
    expect(await sendAffiliateAuthEmailWithResend(inbox, "applicant")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("logs only an HTTP status class when the mail provider refuses a generated code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json(true))
        .mockResolvedValueOnce(generate())
        .mockResolvedValueOnce(new Response("sensitive-provider-message", { status: 403 }));
      vi.stubGlobal("fetch", fetcher);
      expect(await sendAffiliateAuthEmailWithResend(inbox, "owner")).toBe(false);
      expect(warn).toHaveBeenCalledWith("[vonix-affiliate-auth-mail] resend-api-http http=403");
      expect(JSON.stringify(warn.mock.calls)).not.toContain(inbox);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("123456");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-provider-message");
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects malformed recipient addresses and invalid delivery receipts", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await sendAffiliateAuthEmailWithResend("wrong-email", "applicant")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(generate())
      .mockResolvedValueOnce(Response.json({ unexpected: 1 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await sendAffiliateAuthEmailWithResend(inbox, "owner")).toBe(false);
  });
});
