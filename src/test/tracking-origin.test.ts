import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { Route } from "@/routes/__root";

type InlineScript = { children?: string; src?: string };
const head = (Route as unknown as { options: { head: () => { scripts: InlineScript[] } } }).options.head();
const ga = head.scripts.find((s) => s.children?.includes("googletagmanager.com/gtag/js"))?.children;
const clarity = head.scripts.find((s) => s.children?.includes("clarity.ms/tag/"))?.children;

function simulatePageOrigin(origin: string) {
  const externalScripts: string[] = [];
  const loadHandlers: Array<() => void> = [];
  const dataLayer: unknown[] = [];
  const windowObj: Record<string, unknown> = {
    location: { origin },
    dataLayer,
    addEventListener: (type: string, fn: () => void) => {
      if (type === "load") loadHandlers.push(fn);
    },
  };
  const doc = {
    head: { appendChild: (script: { src?: string }) => externalScripts.push(script.src ?? "") },
    createElement: () => ({ async: false, src: "" }),
    getElementsByTagName: () => [{
      parentNode: {
        insertBefore: (script: { src?: string }) => externalScripts.push(script.src ?? ""),
      },
    }],
  };
  for (const script of [ga, clarity]) {
    if (!script) throw new Error("Bootstrap obrigatório ausente");
    runInNewContext(script, { window: windowObj, document: doc, setTimeout: (fn: () => void) => fn(), Date });
  }
  for (const onLoad of loadHandlers) onLoad();
  return { externalScripts, dataLayer, windowObj };
}

describe("rastreamento de produção isolado de localhost e prévias", () => {
  it("não carrega GA4 nem Clarity fora do domínio canônico", () => {
    for (const origin of ["http://127.0.0.1:43972", "https://staging.vonixhair.com", "https://preview.lovable.app"]) {
      const r = simulatePageOrigin(origin);
      expect(r.externalScripts).toEqual([]);
      expect(r.windowObj["gtag"]).toBeUndefined();
      expect(r.windowObj["clarity"]).toBeUndefined();
    }
  });

  it("mantém bootstrap de GA4 e Clarity no domínio real", () => {
    const r = simulatePageOrigin("https://vonixhair.com");
    expect(r.externalScripts).toContain("https://www.googletagmanager.com/gtag/js?id=G-JW91EQ32F3");
    expect(r.externalScripts).toContain("https://www.clarity.ms/tag/zaq09ea2zy");
    expect(typeof r.windowObj["gtag"]).toBe("function");
    expect(typeof r.windowObj["clarity"]).toBe("function");
    expect(r.dataLayer.length).toBe(2);
  });
});
