import { describe, expect, it } from "vitest";
import { isAllowedCarrier } from "@/lib/carriers";

describe("isAllowedCarrier", () => {
  it("aceita JeT, Jadlog e Correios", () => {
    for (const name of ["JeT", "J&T Express", "Jadlog", "Correios", "CORREIOS"]) {
      expect(isAllowedCarrier(name)).toBe(true);
    }
  });

  it("recusa as demais transportadoras", () => {
    for (const name of ["Total Express", "Loggi", "LATAM Cargo", "Azul Cargo Express", "Buslog", "", "Jetsmart"]) {
      expect(isAllowedCarrier(name)).toBe(false);
    }
  });
});
