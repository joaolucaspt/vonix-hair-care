import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: (args: unknown) => unknown) => fn }) }),
}));
import { registerLead } from "@/lib/leads.functions";
const call = registerLead as unknown as (a: { data: { email: string } }) => Promise<{ ok: boolean; saved: boolean }>;

beforeEach(() => {
  vi.stubEnv("LEAD_WEBHOOK_URL", "");
  vi.stubEnv("AFFILIATE_APP_URL", "https://app.example.com/");
  vi.stubEnv("AFFILIATE_SITE_SECRET", "s".repeat(32));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("cadastro vai para o app de expedição", () => {
  it("envia com o segredo e confirma quando o app aceita", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await call({ data: { email: "a@b.co" } })).toMatchObject({ ok: true, saved: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://app.example.com/api/public/contatos");
    expect(init.headers["authorization"]).toBe(`Bearer ${"s".repeat(32)}`);
  });
  it("não confirma se o app recusar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await call({ data: { email: "a@b.co" } })).toMatchObject({ ok: false, saved: false });
  });
});
