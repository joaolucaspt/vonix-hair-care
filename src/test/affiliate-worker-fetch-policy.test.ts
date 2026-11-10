import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const privilegedModules = [
  "affiliate-applications.server.ts",
  "affiliate-invites.server.ts",
  "affiliate-member-auth.server.ts",
  "affiliate-throttle.server.ts",
  "affiliate-functions.ts",
] as const;

describe("Vonix affiliate private requests on Cloudflare Workers", () => {
  it.each(privilegedModules)("does not use unsupported redirect:error in %s", (filename) => {
    // Cloudflare Workers' Request does not support redirect:'error':
    // this throws a TypeError BEFORE sending the request to Supabase.
    // Manual mode returns 3xx without forwarding private auth headers.
    const source = readFileSync(join(process.cwd(), "src", "lib", filename), "utf8");
    expect(source).not.toMatch(/redirect:\s*["']error["']/);
    expect(source).toMatch(/redirect:\s*["']manual["']/);
  });
});
