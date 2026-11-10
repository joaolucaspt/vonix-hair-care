import { describe, expect, it } from "vitest";
import {
  affiliateLinkRecoveryMessage,
  affiliateLinkRecoveryReason,
} from "@/lib/affiliate-auth-recovery";

describe("Affiliate admin authentication link recovery", () => {
  it("detects Supabase expired-token error fragments without needing a token", () => {
    expect(
      affiliateLinkRecoveryReason(
        "https://vonixhair.com/acesso-equipe-afiliadas#error=access_denied&error_code=otp_expired&error_description=Sensitive",
      ),
    ).toBe("expired");
    expect(
      affiliateLinkRecoveryReason(
        "https://vonixhair.com/acesso-equipe-afiliadas?error=access_denied&error_code=otp_expired",
      ),
    ).toBe("expired");
  });

  it("handles other failure codes without rendering provider descriptions", () => {
    expect(
      affiliateLinkRecoveryReason(
        "https://vonixhair.com/acesso-equipe-afiliadas#error=access_denied&error_description=Private",
      ),
    ).toBe("failed");
    expect(affiliateLinkRecoveryMessage("failed")).not.toContain("Private");
    expect(affiliateLinkRecoveryMessage("expired")).toContain("um código");
    expect(affiliateLinkRecoveryMessage("expired")).toContain("um link");
  });

  it("does not falsely classify a valid session callback or normal navigation", () => {
    expect(affiliateLinkRecoveryReason("https://vonixhair.com/acesso-equipe-afiliadas")).toBeNull();
    expect(
      affiliateLinkRecoveryReason(
        "https://vonixhair.com/acesso-equipe-afiliadas?code=example-code",
      ),
    ).toBeNull();
    expect(
      affiliateLinkRecoveryReason(
        "https://vonixhair.com/acesso-equipe-afiliadas#access_token=example-token",
      ),
    ).toBeNull();
  });
});
