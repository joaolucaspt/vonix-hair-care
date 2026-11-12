import { describe, expect, it } from "vitest";
import { affiliateWhatsAppContactUrl } from "@/lib/affiliate-whatsapp-contact";

describe("owner-only manual WhatsApp contact for consented affiliate applicants", () => {
  it("builds a private Brazilian WhatsApp link from validated national numbers only", () => {
    const national = affiliateWhatsAppContactUrl("(31) 99999-9999");
    expect(national).toMatch(/^https:\/\/wa\.me\/5531999999999\?text=/);
    expect(affiliateWhatsAppContactUrl("+55 (31) 99999-9999")).toBe(national);
    expect(affiliateWhatsAppContactUrl("31 3333-4444")).toMatch(/^https:\/\/wa\.me\/553133334444/);
    const composed = new URL(national!);
    expect(composed.hostname).toBe("wa.me");
    expect(composed.searchParams.get("text")).toContain("Vonix Hair");
    expect(composed.searchParams.get("text")).not.toContain("Segredo da candidata");
    expect(composed.searchParams.get("text")).not.toContain("00000000-0000");
  });

  it("refuses dangerous, invalid, non-Brazilian, truncated or missing input", () => {
    for (const phone of [
      "",
      "not-a-number",
      "1199",
      "+1 415 555 1212",
      "11111111111",
      "https://attacker.invalid",
      "(31) 99999-9999?x=1",
      "+55 00 99999 9999",
      "\n(31) 99999-9999",
      "553199999999912345",
      "31 1111-1111",
    ]) {
      expect(affiliateWhatsAppContactUrl(phone)).toBeNull();
    }
    expect(affiliateWhatsAppContactUrl(null)).toBeNull();
    expect(affiliateWhatsAppContactUrl(undefined)).toBeNull();
  });
});
