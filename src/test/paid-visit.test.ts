import { describe, expect, it } from "vitest";
import { isPaidSearch } from "@/lib/paid-visit";

describe("visita de anúncio", () => {
  it("reconhece o clique do Meta e a mídia paga", () => {
    expect(isPaidSearch("?fbclid=abc")).toBe(true);
    expect(isPaidSearch("?utm_source=meta&utm_medium=paid&utm_campaign=x")).toBe(true);
  });
  it("visita comum ou de afiliada não conta como anúncio", () => {
    expect(isPaidSearch("")).toBe(false);
    expect(isPaidSearch("?ref=isabela")).toBe(false);
    expect(isPaidSearch("?utm_medium=email")).toBe(false);
  });
});
