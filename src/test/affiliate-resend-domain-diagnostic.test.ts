import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

const setup = vi.hoisted(() => ({
  key: vi.fn(),
  env: vi.fn(),
}));
vi.mock("@/lib/affiliate-resend-config.server", () => ({ affiliateResendApiKey: setup.key }));
vi.mock("@/lib/env.server", () => ({ env: setup.env }));

import { inspectAffiliateResendSenderDomain } from "@/lib/affiliate-resend-domain.server";

beforeEach(() => {
  vi.resetAllMocks();
  setup.key.mockReturnValue("re_synthetic_test_key_with_more_than_twenty_chars");
  setup.env.mockImplementation((name: string) =>
    name === "AFFILIATE_FROM_EMAIL" ? "Vonix Hair <convites@vonixhair.com>" : "",
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("no-send Resend sender diagnostic", () => {
  it("recognizes a verified sending domain without attempting any outgoing email", async () => {
    const fn = vi.fn().mockResolvedValue(
      Response.json({
        object: "list",
        has_more: false,
        data: [{ name: "vonixhair.com", status: "verified" }],
      }),
    );
    vi.stubGlobal("fetch", fn);
    expect(await inspectAffiliateResendSenderDomain()).toEqual({
      status: "verified",
      domain: "vonixhair.com",
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]![0]).toBe("https://api.resend.com/domains?limit=100");
    expect(fn.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
    expect(JSON.stringify(fn.mock.calls[0]![1])).not.toContain("convites@vonixhair.com");
  });
  it("distinguishes a sending-only API key from an unverified domain", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fn);
    expect(await inspectAffiliateResendSenderDomain()).toEqual({ status: "read-restricted" });
    expect(fn).toHaveBeenCalledOnce();
  });
  it("identifies domain DNS verification pending without claiming deliverability", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: [{ name: "vonixhair.com", status: "pending" }], has_more: false }),
        ),
    );
    expect(await inspectAffiliateResendSenderDomain()).toEqual({
      status: "pending",
      domain: "vonixhair.com",
    });
  });
  it("rejects invalid sender and missing key without contacting provider", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn);
    setup.env.mockReturnValue("not a sender");
    expect(await inspectAffiliateResendSenderDomain()).toEqual({ status: "sender-invalid" });
    setup.env.mockReturnValue("convites@vonixhair.com");
    setup.key.mockReturnValue("");
    expect(await inspectAffiliateResendSenderDomain()).toEqual({ status: "not-configured" });
    expect(fn).not.toHaveBeenCalled();
  });
  it("never leaks provider response bodies, addresses, token or secret on failed calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "PRIVATE_SECRET", domain: "PRIVATE" }), {
          status: 500,
        }),
      ),
    );
    const result = await inspectAffiliateResendSenderDomain();
    expect(result).toEqual({ status: "provider-unavailable" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(JSON.stringify(result)).not.toContain("re_synthetic");
  });
  it("treats incomplete page/invalid data as unverified evidence, never confirms success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [], has_more: true })));
    expect(await inspectAffiliateResendSenderDomain()).toEqual({ status: "not-verifiable" });
  });
});

it("distinguishes rejected Resend credentials (401) from scoped sending-only keys (403)", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
  expect(await inspectAffiliateResendSenderDomain()).toEqual({ status: "key-unauthorized" });
});
