import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const baseUrl = "http://127.0.0.1:43972";
const dir = resolve("qa-artifacts/vonix-c30");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 900 ? 900 : 840 },
      javascriptEnabled: false,
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
    const result = {
      width,
      headerSearch: false,
      catalogSearch: false,
      productMobileSearch: width >= 900 ? "not applicable" : false,
    };
    try {
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
      const form = page
        .locator("form")
        .filter({ has: page.getByPlaceholder("Buscar produtos, kits, tratamentos...") })
        .filter({ visible: true })
        .first();
      await form.waitFor({ timeout: 10000 });
      await form.getByRole("searchbox").fill("cafe verde");
      await form.getByRole("button", { name: "Buscar" }).click();
      await page.waitForURL(/\/loja\?q=cafe(?:\+|%20)verde/, { timeout: 5000 });
      await page
        .getByText(/Kit Café Verde/i)
        .first()
        .waitFor({ timeout: 6000 });
      result.headerSearch = true;
    } catch (e) {
      result.headerError = String(e).slice(0, 240);
    }
    try {
      await page.goto(baseUrl + "/loja?categoria=kits", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const input = page.getByRole("searchbox", { name: "Buscar na loja" });
      await input.fill("banana");
      await page.getByRole("button", { name: "Buscar" }).last().click();
      await page.waitForURL(
        /\/loja\?.*q=banana.*categoria=kits|\/loja\?.*categoria=kits.*q=banana/,
        { timeout: 5000 },
      );
      const active = page.locator('a[href="/produto/kit-banana-e-mel"]').first();
      await active.waitFor({ timeout: 6000 });
      result.catalogSearch = true;
      await page.screenshot({ path: resolve(dir, "search-no-js-" + width + ".png") });
    } catch (e) {
      result.catalogError = String(e).slice(0, 240);
    }
    if (width < 900) {
      try {
        await page.goto(baseUrl + "/produto/kit-banana-e-mel", {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const native = page.getByRole("link", { name: /Buscar produtos/i }).first();
        await native.waitFor({ timeout: 3000 });
        await native.click();
        await page.waitForURL("**/loja", { timeout: 8000 });
        result.productMobileSearch = true;
      } catch (e) {
        result.mobileError = String(e).slice(0, 240);
      }
    }
    result.passed = Boolean(
      result.headerSearch &&
      result.catalogSearch &&
      (width >= 900 || result.productMobileSearch === true),
    );
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C30",
  mode: "JavaScript disabled, native search and product header navigation",
  externalNetworkBlocked: true,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "search-no-js-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
