import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), rotate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ config }),
}));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    ({
      BLING_SETUP_SECRET: "s".repeat(32),
      BLING_CLIENT_ID: "client-test",
      BLING_CLIENT_SECRET: "secret-test",
    })[name] ?? "",
}));
vi.mock("@/lib/bling-refresh.server", () => ({
  readBlingRefreshToken: mocks.read,
  rotateBlingRefreshToken: mocks.rotate,
}));
import { beginBlingOAuth } from "@/routes/api.internal.bling-connect";
import { receiveBlingCallback } from "@/routes/api.public.bling.callback";

const begin = (secret: string) =>
  new Request("https://vonixhair.com/api/internal/bling-connect", {
    method: "POST",
    body: new URLSearchParams({ setup_secret: secret }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue("existing-refresh-token-long");
  mocks.rotate.mockResolvedValue(undefined);
});

describe("Bling OAuth hardening", () => {
  it("rejects callers without the setup secret", async () => {
    const response = await beginBlingOAuth(begin("wrong-secret"));
    expect(response.status).toBe(401);
  });
  it("sets an HttpOnly state cookie and validates the callback before exchanging codes", async () => {
    const start = await beginBlingOAuth(begin("s".repeat(32)));
    expect(start.status).toBe(303);
    const target = new URL(start.headers.get("location")!);
    const state = target.searchParams.get("state")!;
    expect(state.length).toBe(32);
    expect(start.headers.get("set-cookie")).toContain("HttpOnly");
    expect(start.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(start.headers.get("set-cookie")).toContain("Secure");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          refresh_token: "new-refresh-token-from-test-only",
        }),
      ),
    );
    const callback = new Request(
      `https://vonixhair.com/api/public/bling/callback?code=authorization&state=${state}`,
      {
        headers: { cookie: `vonix_bling_oauth_state=${state}` },
      },
    );
    const response = await receiveBlingCallback(callback);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.text()).not.toContain("new-refresh-token-from-test-only");
    expect(mocks.rotate).toHaveBeenCalledWith(
      "existing-refresh-token-long",
      "new-refresh-token-from-test-only",
    );
  });
  it("does not exchange an OAuth code on a static or unbound state", async () => {
    const response = await receiveBlingCallback(
      new Request("https://vonixhair.com/api/public/bling/callback?state=vonix&code=x"),
    );
    expect(response.status).toBe(400);
    expect(mocks.rotate).not.toHaveBeenCalled();
  });
});
