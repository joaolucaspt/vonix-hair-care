import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const ipHeaders = vi.hoisted(() => ({ cf: "203.0.113.14", xff: "", real: "", ray: "" }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) =>
    name === "cf-ray"
      ? ipHeaders.ray
      : name === "cf-connecting-ip"
        ? ipHeaders.cf
        : name === "x-forwarded-for"
          ? ipHeaders.xff
          : name === "x-real-ip"
            ? ipHeaders.real
            : undefined,
}));
import {
  affiliateIpDigest,
  affiliateTrustedIpHeaderValid,
  affiliateRateLimitAllowed,
  consumeAffiliateRateLimit,
} from "@/lib/affiliate-throttle.server";

const original = {
  url: process.env["AFFILIATE_SUPABASE_URL"],
  ref: process.env["AFFILIATE_SUPABASE_PROJECT_REF"],
  key: process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"],
  pepper: process.env["AFFILIATE_TRAFFIC_PEPPER"],
  header: process.env["AFFILIATE_TRUSTED_IP_HEADER"],
};
beforeEach(() => {
  process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
  process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
  process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "fake-service-role-for-unit-test";
  process.env["AFFILIATE_TRAFFIC_PEPPER"] = "very-long-hmac-pepper-only-for-unit-testing-1234";
  process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "cf-connecting-ip";
  ipHeaders.cf = "203.0.113.14";
  ipHeaders.xff = "";
  ipHeaders.ray = "";
});
afterEach(() => {
  const values = {
    AFFILIATE_SUPABASE_URL: original.url,
    AFFILIATE_SUPABASE_PROJECT_REF: original.ref,
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: original.key,
    AFFILIATE_TRAFFIC_PEPPER: original.pepper,
    AFFILIATE_TRUSTED_IP_HEADER: original.header,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe("Persisted affiliate request rate limiting", () => {
  it("uses an HMAC fingerprint instead of storing or transmitting an IP", () => {
    const pepper = process.env["AFFILIATE_TRAFFIC_PEPPER"]!;
    const first = affiliateIpDigest("203.0.113.14", "submit", pepper);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.14");
    expect(first).toBe(affiliateIpDigest("203.0.113.14", "submit", pepper));
    expect(first).not.toBe(affiliateIpDigest("203.0.113.14", "admin", pepper));
    expect(first).not.toBe(affiliateIpDigest("203.0.113.15", "submit", pepper));
    expect(affiliateIpDigest("203.0.113.14, 127.0.0.1", "submit", pepper)).toBeNull();
    expect(affiliateIpDigest("203.0.113.14", "submit", "short")).toBeNull();
  });

  it("calls the atomic database quota with scope and HMAC only", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe(
      "https://abcdefghijklmnopqrst.supabase.co/rest/v1/rpc/vonix_affiliate_consume_rate_limit",
    );
    const body = JSON.parse(init.body);
    expect(body.p_scope).toBe("submit");
    expect(body.p_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(init.body).not.toContain("203.0.113.14");
  });

  it("checks admin lockouts without incrementing successful sessions", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(await affiliateRateLimitAllowed("admin")).toBe(true);
    expect(mock.mock.calls[0]![0]).toContain("vonix_affiliate_rate_limit_allowed");
  });

  it("fails closed without proxy IP or pepper, without making requests", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    ipHeaders.cf = "";
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(mock).not.toHaveBeenCalled();
    ipHeaders.cf = "203.0.113.14";
    process.env["AFFILIATE_TRAFFIC_PEPPER"] = "too-short";
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });

  it("never trusts a client-supplied Cloudflare header without explicit proxy configuration", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(true));
    vi.stubGlobal("fetch", mock);
    expect(affiliateTrustedIpHeaderValid()).toBe(true);
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    delete process.env["AFFILIATE_TRUSTED_IP_HEADER"];
    expect(affiliateTrustedIpHeaderValid()).toBe(false);
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "unsafe-header";
    expect(affiliateTrustedIpHeaderValid()).toBe(false);
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(mock).toHaveBeenCalledOnce();
  });

  it("uses Cloudflare-owned client IP when both CF headers are present", async () => {
    const request = vi.fn().mockResolvedValue(Response.json(true));
    vi.stubGlobal("fetch", request);
    delete process.env["AFFILIATE_TRUSTED_IP_HEADER"];
    ipHeaders.ray = "a13b024cd12345ff-BHZ";
    expect(affiliateTrustedIpHeaderValid()).toBe(true);
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    expect(request).toHaveBeenCalledOnce();
    ipHeaders.ray = "";
    expect(affiliateTrustedIpHeaderValid()).toBe(false);
  });

  it("only consumes the selected proxy header, ignoring conflicting client-supplied headers", async () => {
    const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(true)));
    vi.stubGlobal("fetch", mock);
    ipHeaders.cf = "203.0.113.14";
    ipHeaders.xff = "192.0.2.99, 10.10.0.1";
    ipHeaders.real = "192.0.2.44";
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "x-forwarded-for";
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    const first = JSON.parse(String(mock.mock.calls[0]![1].body));
    expect(first.p_fingerprint).toBe(
      affiliateIpDigest("192.0.2.99", "submit", process.env["AFFILIATE_TRAFFIC_PEPPER"]!),
    );
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "x-real-ip";
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    const second = JSON.parse(String(mock.mock.calls[1]![1].body));
    expect(second.p_fingerprint).toBe(
      affiliateIpDigest("192.0.2.44", "submit", process.env["AFFILIATE_TRAFFIC_PEPPER"]!),
    );
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "cf-connecting-ip";
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    const third = JSON.parse(String(mock.mock.calls[2]![1].body));
    expect(third.p_fingerprint).toBe(
      affiliateIpDigest("203.0.113.14", "submit", process.env["AFFILIATE_TRAFFIC_PEPPER"]!),
    );
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("never sends rate-limit data or service key to the checkout database", async () => {
    const originalStoreUrl = process.env["SUPABASE_URL"];
    const originalStoreKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const dedicatedUrl = process.env["AFFILIATE_SUPABASE_URL"];
    const dedicatedKey = process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    try {
      process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "store-only-service-role-key";
      delete process.env["AFFILIATE_SUPABASE_URL"];
      delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect(await consumeAffiliateRateLimit("submit")).toBe(false);
      expect(await affiliateRateLimitAllowed("admin")).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (originalStoreUrl === undefined) delete process.env["SUPABASE_URL"];
      else process.env["SUPABASE_URL"] = originalStoreUrl;
      if (originalStoreKey === undefined) delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
      else process.env["SUPABASE_SERVICE_ROLE_KEY"] = originalStoreKey;
      if (dedicatedUrl === undefined) delete process.env["AFFILIATE_SUPABASE_URL"];
      else process.env["AFFILIATE_SUPABASE_URL"] = dedicatedUrl;
      if (dedicatedKey === undefined) delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
      else process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = dedicatedKey;
    }
  });

  it("enforces database denial and fails closed on network errors", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(false))
      .mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", mock);
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
  });
});
