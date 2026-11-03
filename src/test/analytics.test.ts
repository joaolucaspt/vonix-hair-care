import { describe, expect, it } from "vitest";
import { catalogId, metaParams } from "@/lib/analytics";

describe("rastreio com os códigos do catálogo da Meta", () => {
  it("monta o código do catálogo igual ao cadastrado", () => {
    expect(catalogId("progressiva-fio-de-luz")).toBe("VONIX-PROGRESSIVA-FIO-DE-LUZ");
    expect(catalogId("botox-vonix")).toBe("VONIX-BOTOX-VONIX");
    expect(catalogId("progressiva-diamond")).toBe("VONIX-PROGRESSIVA-DIAMOND");
    expect(catalogId("kit-banana-e-mel")).toBe("VONIX-COMBO-BANANA-E-MEL");
  });
  it("envia content_ids e contents com o mesmo código", () => {
    const m = metaParams({ value: 174.9, items: [{ item_id: "VONIX-BOTOX-VONIX", item_name: "Botox", item_variant: "1Kg", price: 164.9, quantity: 2 }] });
    expect(m.content_ids).toEqual(["VONIX-BOTOX-VONIX"]);
    expect(m.contents).toEqual([{ id: "VONIX-BOTOX-VONIX", quantity: 2, item_price: 164.9 }]);
    expect(m.value).toBe(174.9);
    expect(m.num_items).toBe(2);
    expect(m.content_type).toBe("product");
  });
});
