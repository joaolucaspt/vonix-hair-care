import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { Route } from "@/routes/__root";
import { TRACKING_CONSENT_KEY } from "@/lib/tracking-consent";

type InlineScript = { children?: string; src?: string };
const head = (Route as unknown as { options: { head: () => { scripts: InlineScript[] } } }).options.head();
const bootstrap = head.scripts.find((s) => s.children?.includes("__vonixMarketingAllowed=function"))?.children;
const ga = head.scripts.find((s) => s.children?.includes("googletagmanager.com/gtag/js"))?.children;
const clarity = head.scripts.find((s) => s.children?.includes("clarity.ms/tag/"))?.children;
const meta = head.scripts.find((s) => s.children?.includes("connect.facebook.net/en_US/fbevents.js"))?.children;

function simulate(origin: string, choice: string | null, blocked = false) {
  const externalScripts: string[] = [];
  const requests: string[] = [];
  const loadHandlers: Array<() => void> = [];
  const dataLayer: unknown[] = [];
  const sandbox: Record<string, unknown> = {
    location: { origin, href: origin + "/", search: "" },
    dataLayer,
    Date,
    Math,
    URLSearchParams,
    setTimeout: (fn: () => void) => fn(),
    fetch: (url: string) => {
      requests.push(url);
      return Promise.resolve({ ok: true });
    },
  };
  sandbox["window"] = sandbox;
  sandbox["localStorage"] = {
    getItem: (key: string) => {
      if (blocked) throw new DOMException("Storage denied", "SecurityError");
      return key === TRACKING_CONSENT_KEY ? choice : null;
    },
  };
  sandbox["addEventListener"] = (type: string, fn: () => void) => {
    if (type === "load") loadHandlers.push(fn);
  };
  sandbox["document"] = {
    cookie: "",
    head: { appendChild: (script: { src?: string }) => externalScripts.push(script.src ?? "") },
    createElement: () => ({ async: false, src: "" }),
    getElementsByTagName: () => [{
      parentNode: {
        insertBefore: (script: { src?: string }) => externalScripts.push(script.src ?? ""),
      },
    }],
  };
  for (const script of [bootstrap, ga, clarity, meta]) {
    if (!script) throw new Error("Rastreador obrigatório ausente do HTML");
    runInNewContext(script, sandbox);
  }
  for (const handler of loadHandlers) handler();
  return { externalScripts, requests, dataLayer, sandbox };
}

describe("rastreamento respeita origem e consentimento opcional", () => {
  it("nega GA4, Clarity, Pixel e CAPI antes de qualquer decisão", () => {
    for (const choice of [null, "rejected", "desconhecido"]) {
      const r = simulate("https://vonixhair.com", choice);
      expect(r.externalScripts).toEqual([]);
      expect(r.requests).toEqual([]);
      expect(r.sandbox["gtag"]).toBeUndefined();
      expect(r.sandbox["fbq"]).toBeUndefined();
    }
  });

  it("bloqueio de localStorage também nega rastreadores sem travar a página", () => {
    const r = simulate("https://vonixhair.com", "accepted", true);
    expect(r.externalScripts).toEqual([]);
    expect(r.requests).toEqual([]);
  });

  it("consentimento salvo não habilita rastreadores em localhost ou prévias", () => {
    for (const origin of ["http://127.0.0.1:43972", "https://staging.vonixhair.com", "https://preview.lovable.app"]) {
      const r = simulate(origin, "accepted");
      expect(r.externalScripts).toEqual([]);
      expect(r.requests).toEqual([]);
      expect(r.sandbox["gtag"]).toBeUndefined();
      expect(r.sandbox["fbq"]).toBeUndefined();
    }
  });

  it("carrega os três serviços e PageView somente após consentimento na loja publicada", () => {
    const r = simulate("https://vonixhair.com", "accepted");
    expect(r.externalScripts).toContain("https://www.googletagmanager.com/gtag/js?id=G-JW91EQ32F3");
    expect(r.externalScripts).toContain("https://www.clarity.ms/tag/zaq09ea2zy");
    expect(r.externalScripts).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(r.requests).toContain("/api/public/meta-event");
    expect(typeof r.sandbox["gtag"]).toBe("function");
    expect(typeof r.sandbox["fbq"]).toBe("function");
    expect(r.dataLayer.length).toBe(2);
  });
});
