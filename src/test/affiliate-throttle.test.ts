import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const ipHeaders = vi.hoisted(() => ({ cf: "203.0.113.14", xff: "" }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) =>
    name === "cf-connecting-ip"
      ? ipHeaders.cf
      : name === "x-forwarded-for"
        ? ipHeaders.xff
        : undefined,
}));
import {
  affiliateIpDigest,
  affiliateRateLimitAllowed,
  consumeAffiliateRateLimit,
} from "@/lib/affiliate-throttle.server";

const original = {
  url: process.env["SUPABASE_URL"],
  key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  pepper: process.env["AFFILIATE_TRAFFIC_PEPPER"],
  header: process.env["AFFILIATE_TRUSTED_IP_HEADER"],
};
beforeEach(() => {
  process.env["SUPABASE_URL"] = "https://example.supabase.co";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "fake-service-role-for-unit-test";
  process.env["AFFILIATE_TRAFFIC_PEPPER"] = "very-long-hmac-pepper-only-for-unit-testing-1234";
  delete process.env["AFFILIATE_TRUSTED_IP_HEADER"];
  ipHeaders.cf = "203.0.113.14";
  ipHeaders.xff = "";
});
afterEach(() => {
  const values = {
    SUPABASE_URL: original.url,
    SUPABASE_SERVICE_ROLE_KEY: original.key,
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
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/vonix_affiliate_consume_rate_limit");
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

  it("rejects a spoofed X-Forwarded-For header by default", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(true));
    vi.stubGlobal("fetch", mock);
    ipHeaders.cf = "";
    ipHeaders.xff = "192.0.2.99, 10.10.0.1";
    expect(await consumeAffiliateRateLimit("submit")).toBe(false);
    expect(mock).not.toHaveBeenCalled();
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "x-forwarded-for";
    expect(await consumeAffiliateRateLimit("submit")).toBe(true);
    expect(mock).toHaveBeenCalledOnce();
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
