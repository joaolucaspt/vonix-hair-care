import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const play = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(play);
const origin = process.env.VONIX_C38_ORIGIN ?? "http://127.0.0.1:43982";
const folder = resolve("qa-artifacts/vonix-c38/promotion");
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const outcomes = [];
try {
  for (const width of [320, 390, 1366]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width >= 900 ? 900 : 844 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    let blockedExternal = 0;
    await ctx.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" || url.protocol === "data:") return route.continue();
      blockedExternal++;
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const status = { width, passed: false, blockedExternal };
    try {
      const pdp = await page.goto(origin + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 22000,
      });
      if (pdp?.status() !== 200) throw Error("Base PDP HTTP " + pdp?.status());
      await page.getByRole("heading", { level: 1, name: /Kit Banana e Mel/ }).waitFor();
      await page.getByRole("button", { name: "Comprar agora" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Item adicionado" });
      await drawer.waitFor();
      await drawer.getByRole("button", { name: "Fechar" }).click();
      await drawer.waitFor({ state: "hidden" });
      const cart = await page.goto(origin + "/carrinho", {
        waitUntil: "domcontentloaded",
        timeout: 22000,
      });
      if (cart?.status() !== 200) throw Error("Cart HTTP " + cart?.status());
      const suggestion = page.getByRole("button", { name: /Adicionar S[eé]rum Argan à sacola/i });
      await suggestion.waitFor({ timeout: 12000 });
      await suggestion.click();
      const row = page.locator("ul.divide-y > li").filter({ hasText: /S[eé]rum Argan/i });
      await row.waitFor();
      await row.getByText(/5% OFF neste item/).waitFor();
      const initial = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem("vonix-cart") || "[]");
        return items.find((x) => x.slug === "serum-argan");
      });
      if (initial?.qty !== 1 || initial?.offer !== "comp5")
        throw Error("Initial comp5 was not single-unit " + JSON.stringify(initial));
      const increment = row.getByRole("button", { name: /Aumentar quantidade de S[eé]rum Argan/i });
      await increment.click();
      await page.waitForFunction(() => {
        const c = JSON.parse(localStorage.getItem("vonix-cart") || "[]");
        const line = c.find((x) => x.slug === "serum-argan");
        return line?.qty === 2 && !line.offer;
      });
      await row.getByText(/12% OFF por levar 2 unidades/i).waitFor();
      await row.getByText("R$ 163,50", { exact: true }).waitFor();
      await page.screenshot({ path: resolve(folder, "volume2-" + width + ".png") });

      await increment.click();
      await page.waitForFunction(() => {
        const c = JSON.parse(localStorage.getItem("vonix-cart") || "[]");
        const line = c.find((x) => x.slug === "serum-argan");
        return line?.qty === 3 && !line.offer;
      });
      await row.getByText(/15% OFF por levar 3 unidades/i).waitFor();
      await row.getByText("R$ 236,90", { exact: true }).waitFor();
      await page.screenshot({ path: resolve(folder, "volume3-" + width + ".png") });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      );
      if (overflow) throw Error("Cart horizontal overflow");
      if (errors.length) throw Error("Client JS error " + JSON.stringify(errors));
      status.passed = true;
      status.volume1 = { qty: 1, offer: "comp5" };
      status.volume2 = { qty: 2, offer: null, gross: 185.8, net: 163.5 };
      status.volume3 = { qty: 3, offer: null, gross: 278.7, net: 236.9 };
    } catch (error) {
      status.error = String(error);
    } finally {
      status.blockedExternal = blockedExternal;
      outcomes.push(status);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C38",
  scope:
    "Real Chrome UI/cart pricing for complementary promotion, external blocked; no checkout charge",
  passed: outcomes.filter((x) => x.passed).length,
  failed: outcomes.filter((x) => !x.passed).length,
  results: outcomes,
};
await writeFile(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
