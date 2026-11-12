import { describe, expect, it } from "vitest";
import { BF_END, BF_START, bfEsquentaAberto, bfPct, bfPhase } from "@/lib/black-friday";
import { lineTotals, linePct } from "@/lib/store";

const antes = new Date("2026-11-20T12:00:00-03:00");
const durante = new Date("2026-11-28T12:00:00-03:00");
const depois = new Date("2026-12-02T12:00:00-03:00");

describe("Black Friday 2026", () => {
  it("fases pelas datas reais", () => {
    expect(bfPhase(antes)).toBe("esquenta");
    expect(bfPhase(BF_START)).toBe("ativa");
    expect(bfPhase(durante)).toBe("ativa");
    expect(bfPhase(BF_END)).toBe("ativa");
    expect(bfPhase(depois)).toBe("encerrada");
    expect(bfEsquentaAberto(antes)).toBe(true);
    expect(bfEsquentaAberto(durante)).toBe(false);
  });
  it("no esquenta e depois do prazo o preço não muda", () => {
    for (const d of [antes, depois]) {
      expect(bfPct("botox-vonix", d)).toBe(0);
      expect(lineTotals(180.9, 1, undefined, "botox-vonix", d).net).toBe(180.9);
    }
  });
  it("durante a oferta: kits 20%, Botox 30%, Fio de Luz 15%, Monovonix e o resto ficam como estão", () => {
    expect(bfPct("kit-cronograma-capilar", durante)).toBe(20);
    expect(bfPct("botox-vonix", durante)).toBe(30);
    expect(bfPct("botox-line-matizador", durante)).toBe(30);
    expect(bfPct("progressiva-fio-de-luz", durante)).toBe(15);
    expect(bfPct("kit-monovonix", durante)).toBe(0);
    expect(bfPct("plex-vonix", durante)).toBe(0);
    expect(lineTotals(180.9, 1, undefined, "botox-vonix", durante).net).toBe(126.63);
    expect(lineTotals(184.9, 1, undefined, "kit-cronograma-capilar", durante).net).toBe(147.92);
  });
  it("não soma com o leve 2 / leve 3: vale o maior", () => {
    expect(linePct(2, "botox-vonix", durante)).toBe(30);
    expect(linePct(3, "progressiva-fio-de-luz", durante)).toBe(15);
    expect(linePct(2, "kit-cronograma-capilar", durante)).toBe(20);
    expect(linePct(2, "plex-vonix", durante)).toBe(12);
    expect(linePct(1, "plex-vonix", durante)).toBe(0);
  });
});
