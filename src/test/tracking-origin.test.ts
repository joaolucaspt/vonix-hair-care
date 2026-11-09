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

function simulate(origin: string, choice: string | null, blocked = false, rejectedInSession = false) {
  const externalScripts: string[] = [];
  const requests: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  const loadHandlers: Array<() => void> = [];
  const dataLayer: unknown[] = [];
  const sandbox: Record<string, unknown> = {
    location: { origin, href: origin + "/", search: "" },
    dataLayer,
    Date,
    Math,
    URLSearchParams,
    setTimeout: (fn: () => void) => fn(),
    fetch: (url: string, init?: { body?: string }) => {
      if (init?.body) payloads.push(JSON.parse(init.body) as Record<string, unknown>);
      requests.push(url);
      return Promise.resolve({ ok: true });
    },
  };
  sandbox["window"] = sandbox;
  sandbox["sessionStorage"] = { getItem: () => rejectedInSession ? "rejected" : null };
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
  return { externalScripts, requests, payloads, dataLayer, sandbox };
}

describe("rastreamento respeita origem e consentimento opcional", () => {
  it("impede tags GA4/Clarity/Meta externas estáticas antes de consentimento", () => {
    // The base branch once inserted a direct GA script in <head>. That would
    // bypass every runtime opt-in check even if the inline simulator passed.
    const srcs = head.scripts.map((s) => s.src).filter(Boolean);
    expect(srcs.filter((url) => /googletagmanager\.com|clarity\.ms|facebook\.net/.test(url!))).toEqual([]);
    expect(bootstrap).toContain("__vonixMarketingAllowed");
  });

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

  it("recusa salva na sessão prevalece mesmo sobre um aceite antigo no localStorage", () => {
    const r = simulate("https://vonixhair.com", "accepted", false, true);
    expect(r.externalScripts).toEqual([]);
    expect(r.requests).toEqual([]);
    expect(r.sandbox["gtag"]).toBeUndefined();
    expect(r.sandbox["fbq"]).toBeUndefined();
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
    if (!r.externalScripts.includes("https://www.googletagmanager.com/gtag/js?id=G-J8TYLB425K")) {
      throw new Error("Unexpected GA bootstrap scripts (public URLs only): " + JSON.stringify(r.externalScripts));
    }
    expect(r.externalScripts).toContain("https://www.googletagmanager.com/gtag/js?id=G-J8TYLB425K");
    expect(r.externalScripts).toContain("https://www.clarity.ms/tag/zaq09ea2zy");
    expect(r.externalScripts).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(r.requests).toContain("/api/public/meta-event");
    expect(r.payloads).toContainEqual(expect.objectContaining({ event: "PageView", consent: true }));
    expect(typeof r.sandbox["gtag"]).toBe("function");
    expect(typeof r.sandbox["fbq"]).toBe("function");
    expect(r.dataLayer.length).toBe(2);
  });
});
