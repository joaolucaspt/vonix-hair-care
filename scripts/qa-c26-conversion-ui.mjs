import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const playwright = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(playwright);
const origin = "http://127.0.0.1:43972";
const folder = resolve(process.cwd(), "qa-artifacts/vonix-c26");
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 900 ? 844 : 900 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      return u.hostname === "127.0.0.1" || u.protocol === "data:"
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const check = { width, passed: false, errors };
    try {
      const home = await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
      if (home?.status() !== 200) throw Error("Home HTTP " + home?.status());
      await page.getByRole("heading", { name: "Explore do seu jeito" }).waitFor({ timeout: 12000 });
      await page.getByText("Conhecer este kit").waitFor();
      const homeHref = await page
        .getByRole("link")
        .filter({ hasText: "Para minha rotina" })
        .first()
        .getAttribute("href");
      const salonHref = await page
        .getByRole("link")
        .filter({ hasText: "Para o salão" })
        .first()
        .getAttribute("href");
      if (!homeHref?.includes("uso=casa") || !salonHref?.includes("uso=salao"))
        throw Error("Audience links incorrect: " + homeHref + " " + salonHref);
      const needHref = await page.locator('a[href*="necessidades="]').first().getAttribute("href");
      if (!needHref?.includes("uso=casa")) throw Error("Need link audience invalid: " + needHref);
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: "Pausar destaques" }).click();
      await page.getByRole("button", { name: "Reproduzir destaques" }).waitFor();
      check.homeAudienceAndCarousel = true;
      await page.screenshot({ path: resolve(folder, "home-" + width + ".png"), fullPage: true });
      const cat = await page.goto(origin + "/loja?q=verde+kit+cafe", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (cat?.status() !== 200) throw Error("Catalog HTTP " + cat?.status());
      await page
        .getByText(/Kit Caf[eé] Verde/i)
        .first()
        .waitFor({ timeout: 12000 });
      check.catalogAnyWordOrder = true;
      await page.screenshot({ path: resolve(folder, "catalog-" + width + ".png") });
      const pdp = await page.goto(origin + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (pdp?.status() !== 200) throw Error("PDP HTTP " + pdp?.status());
      const productSchema = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((nodes) =>
          nodes
            .map((n) => {
              try {
                return JSON.parse(n.textContent || "{}");
              } catch {
                return {};
              }
            })
            .find((n) => n["@type"] === "Product"),
        );
      if (!productSchema || !productSchema.offers || "availability" in productSchema.offers)
        throw Error("Unverified stock availability in product schema");
      check.stockClaimRemoved = true;
      await page.screenshot({ path: resolve(folder, "product-" + width + ".png") });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow || errors.length) throw Error(JSON.stringify({ overflow, errors }));
      check.passed = true;
    } catch (e) {
      check.error = String(e);
    } finally {
      results.push(check);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C26",
  scope: "Home + catalog + schema; isolated localhost; external network denied; no payments",
  results,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
};
await writeFile(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
