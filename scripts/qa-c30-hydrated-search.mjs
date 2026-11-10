import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const origin = "http://127.0.0.1:43972";
const dir = resolve("qa-artifacts/vonix-c30/hydrated");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 1000 ? 900 : 840 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
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
    const r = { width, passed: false, errors };
    try {
      await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
      const search = page.getByRole("search", { name: "Pesquisar produtos Vonix Hair" });
      await search.getByRole("searchbox").fill("cafe verde");
      await search.getByRole("button", { name: "Buscar" }).click();
      await page.waitForURL(/\/loja\?q=cafe(?:\+|%20)verde/, { timeout: 15000 });
      await page.locator('a[href="/produto/kit-cafe-verde"]').first().waitFor({ timeout: 10000 });
      r.homeSearch = true;
      await page.screenshot({ path: resolve(dir, "home-search-" + width + ".png") });
      await page.goto(origin + "/loja?categoria=kits&uso=casa", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const lookup = page.getByRole("search", { name: "Buscar produtos" });
      await lookup.getByRole("searchbox").fill("banana");
      await lookup.getByRole("button", { name: "Buscar" }).click();
      await page.waitForURL(
        (url) => {
          const x = new URL(url);
          return (
            x.pathname === "/loja" &&
            x.searchParams.get("q") === "banana" &&
            x.searchParams.get("categoria") === "kits" &&
            x.searchParams.get("uso") === "casa"
          );
        },
        { timeout: 15000 },
      );
      await page.locator('a[href="/produto/kit-banana-e-mel"]').first().waitFor({ timeout: 10000 });
      r.filteredSearch = true;
      await page.screenshot({ path: resolve(dir, "filtered-search-" + width + ".png") });
      await page.goto(origin + "/produto/kit-cachos", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (width < 900) {
        const reveal = page.getByRole("button", { name: "Buscar", exact: true }).first();
        await reveal.waitFor({ timeout: 12000 });
        await reveal.click();
      }
      const pdpSearch = page.getByRole("search", { name: "Pesquisar produtos Vonix Hair" });
      await pdpSearch.getByRole("searchbox").fill("botox");
      await pdpSearch.getByRole("button", { name: "Buscar" }).click();
      await page.waitForURL(
        (url) => {
          const x = new URL(url);
          return x.pathname === "/loja" && x.searchParams.get("q") === "botox";
        },
        { timeout: 15000 },
      );
      await page.locator('a[href="/produto/botox-vonix"]').first().waitFor({ timeout: 12000 });
      r.productSearch = true;
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      );
      if (overflow || errors.length) throw Error(JSON.stringify({ overflow, errors }));
      r.passed = true;
      await page.screenshot({ path: resolve(dir, "product-search-" + width + ".png") });
    } catch (e) {
      r.error = String(e).slice(0, 360);
    }
    results.push(r);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C30",
  mode: "hydrated client navigation, responsive search",
  externalNetworkBlocked: true,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
