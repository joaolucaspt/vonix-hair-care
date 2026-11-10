import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Dedicated Vonix affiliate Supabase invitation callback", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
    window.localStorage.clear();
  });

  it("accepts the implicit session issued by a real Supabase invite verification link", async () => {
    const fakeAccessToken = "synthetic-local-test-access";
    const fakeRefreshToken = "synthetic-local-test-refresh";
    const now = Math.floor(Date.now() / 1000);
    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://jewbzrbbvxyqmxqbrwrq.supabase.co/auth/v1/user")) {
        return Response.json({
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: "invited-owner@example.invalid",
          email_confirmed_at: new Date().toISOString(),
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: new Date().toISOString(),
        });
      }
      throw new Error("Unexpected external request in synthetic callback test");
    });
    vi.stubGlobal("fetch", mockFetch);

    // Supabase Auth's /verify?type=invite endpoint redirects with an implicit
    // #access_token fragment. No real token, domain, invitation or email is used.
    const callback = new URLSearchParams({
      access_token: fakeAccessToken,
      refresh_token: fakeRefreshToken,
      token_type: "bearer",
      expires_in: "3600",
      expires_at: String(now + 3600),
      type: "invite",
    });
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas#" + callback.toString());

    const { vonixAffiliateAuth } = await import("../lib/vonix-affiliate-auth");
    try {
      const { data, error } = await vonixAffiliateAuth.auth.getSession();
      expect(error).toBeNull();
      expect(data.session?.access_token).toBe(fakeAccessToken);
      expect(data.session?.user.email).toBe("invited-owner@example.invalid");
      expect(window.location.hash).toBe("");
      expect(mockFetch).toHaveBeenCalled();
    } finally {
      await vonixAffiliateAuth.auth.stopAutoRefresh();
    }
  });
});
