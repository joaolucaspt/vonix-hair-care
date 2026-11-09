import { afterEach, describe, expect, it } from "vitest";
import {
  affiliateDatabaseConfig,
  requireAffiliateDatabaseConfig,
} from "@/lib/affiliate-database.server";

const variables = [
  "AFFILIATE_SUPABASE_URL",
  "AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",
  "AFFILIATE_SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const original = Object.fromEntries(variables.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const name of variables) {
    const prev = original[name];
    if (prev === undefined) delete process.env[name];
    else process.env[name] = prev;
  }
});

describe("Dedicated database for applicant personal information", () => {
  it("fails closed without dedicated credentials despite complete checkout credentials", () => {
    process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "store-only-service-role-key";
    delete process.env["AFFILIATE_SUPABASE_URL"];
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];

    expect(affiliateDatabaseConfig()).toBeNull();
    expect(() => requireAffiliateDatabaseConfig()).toThrow(/Banco dedicado/);
  });

  it("does not combine the dedicated URL with the checkout key, or vice versa", () => {
    process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "store-only-service-role-key";
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
    process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    expect(affiliateDatabaseConfig()).toBeNull();

    delete process.env["AFFILIATE_SUPABASE_URL"];
    process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "affiliate-only-service-role-key";
    expect(affiliateDatabaseConfig()).toBeNull();
  });

  it("creates an isolated client configuration and never uses checkout credentials", () => {
    process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "store-only-service-role-key";
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
    process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co/";
    process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "affiliate-only-service-role-key";
    const config = requireAffiliateDatabaseConfig();
    expect(config.url).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(config.headers["apikey"]).toBe("affiliate-only-service-role-key");
    expect(config.headers["authorization"]).toBe("Bearer affiliate-only-service-role-key");
    expect(JSON.stringify(config)).not.toContain("store-only-service-role-key");
    expect(JSON.stringify(config)).not.toContain("checkout.example.supabase.co");
  });

  it("can pin the dedicated Supabase project without changing checkout credentials", () => {
    process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "checkout-service-role-key";
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "jewbzrbbvxyqmxqbrwrq";
    process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "dedicated-service-role-key";
    process.env["AFFILIATE_SUPABASE_URL"] = "https://checkout.example.supabase.co";
    expect(affiliateDatabaseConfig()).toBeNull();

    process.env["AFFILIATE_SUPABASE_URL"] = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
    expect(affiliateDatabaseConfig()?.url).toBe("https://jewbzrbbvxyqmxqbrwrq.supabase.co");
    process.env["SUPABASE_URL"] = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
    expect(affiliateDatabaseConfig()).toBeNull();
    process.env["SUPABASE_URL"] = "https://checkout.example.supabase.co";
    delete process.env["AFFILIATE_SUPABASE_PROJECT_REF"];
    expect(affiliateDatabaseConfig()).toBeNull();
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "jewbzrbbvxyqmxqbrwrq";
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "not-a-valid-ref";
    expect(affiliateDatabaseConfig()).toBeNull();
  });

  it("refuses wrong protocols, embedded credentials, paths or short keys", () => {
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
    process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "affiliate-only-service-role-key";
    for (const url of [
      "http://abcdefghijklmnopqrst.supabase.co",
      "https://user:password@abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co/rest/v1",
      "https://abcdefghijklmnopqrst.supabase.co:8443",
      "https://abcdefghijklmnopqrst.supabase.co?secret=unsafe",
      "https://abcdefghijklmnopqrst.supabase.co/#fragment",
      "https://abcdefghijklmnopqrst.supabase.co.attacker.example",
      "invalid",
    ]) {
      process.env["AFFILIATE_SUPABASE_URL"] = url;
      expect(affiliateDatabaseConfig()).toBeNull();
    }
    process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
    process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"] = "short";
    expect(affiliateDatabaseConfig()).toBeNull();
  });
});
