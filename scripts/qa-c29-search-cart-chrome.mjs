import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const origin = "http://127.0.0.1:43972";
const dir = resolve("qa-artifacts/vonix-c29/browser");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 1000 ? 900 : 844 },
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
    const result = { width, passed: false, errors };
    try {
      const search = await page.goto(origin + "/loja?q=verde+combo+cafe", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (search?.status() !== 200) throw Error("search http " + search?.status());
      await page.getByRole("heading", { level: 1, name: /Busca:/ }).waitFor({ timeout: 12000 });
      await page.locator('a[href="/produto/kit-cafe-verde"]').first().waitFor({ timeout: 12000 });
      result.comboAlias = true;
      await page.screenshot({ path: resolve(dir, "alias-" + width + ".png") });
      await page.goto(origin + "/loja?q=1kg+botox", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.locator('a[href="/produto/botox-vonix"]').first().waitFor({ timeout: 12000 });
      result.variantSearch = true;
      await page.goto(origin + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      const add = page.getByRole("button", { name: "Adicionar ao carrinho" }).first();
      await add.waitFor({ state: "visible", timeout: 16000 });
      await page.waitForFunction(() => !!document.querySelector("button:not([disabled])"), null, {
        timeout: 8000,
      });
      await add.click();
      await page.waitForFunction(
        () => {
          const c = JSON.parse(localStorage.getItem("vonix-cart") || "[]");
          return c.some((i) => i.slug === "kit-banana-e-mel" && i.qty === 1);
        },
        null,
        { timeout: 12000 },
      );
      await page.goto(origin + "/carrinho", { waitUntil: "domcontentloaded", timeout: 20000 });
      const minus = page
        .getByRole("button", { name: /Diminuir quantidade de Kit Banana e Mel/ })
        .first();
      const plus = page
        .getByRole("button", { name: /Aumentar quantidade de Kit Banana e Mel/ })
        .first();
      const remove = page.getByRole("button", { name: /Remover Kit Banana e Mel/ }).first();
      await minus.waitFor({ timeout: 15000 });
      if (!(await minus.isDisabled())) throw Error("Minus at 1 still enabled");
      if ((await plus.isDisabled()) || !(await remove.isEnabled()))
        throw Error("Cart actions not available");
      const robots = await page.locator('meta[name="robots"]').first().getAttribute("content");
      if (!robots?.includes("noindex")) throw Error("Private cart meta noindex missing: " + robots);
      result.cartNoIndex = true;
      await page.screenshot({ path: resolve(dir, "cart-min-" + width + ".png") });
      await plus.click();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("vonix-cart") || "[]").some(
            (i) => i.slug === "kit-banana-e-mel" && i.qty === 2,
          ),
        null,
        { timeout: 12000 },
      );
      if (await minus.isDisabled()) throw Error("Minus at 2 still disabled");
      await page.evaluate(() => {
        const c = JSON.parse(localStorage.getItem("vonix-cart") || "[]");
        localStorage.setItem("vonix-cart", JSON.stringify(c.map((i) => ({ ...i, qty: 99 }))));
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      const max = page
        .getByRole("button", { name: /Aumentar quantidade de Kit Banana e Mel/ })
        .first();
      await max.waitFor({ timeout: 12000 });
      if (!(await max.isDisabled())) throw Error("Plus at 99 still enabled");
      result.boundary99 = true;
      await page.screenshot({ path: resolve(dir, "cart-max-" + width + ".png") });
      await page
        .getByRole("button", { name: /Remover Kit Banana e Mel/ })
        .first()
        .click();
      await page
        .getByRole("heading", { name: "Sua sacola está vazia" })
        .waitFor({ timeout: 12000 });
      if (errors.length) throw Error("JS errors " + JSON.stringify(errors));
      result.passed = true;
    } catch (e) {
      result.error = String(e);
    }
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C29",
  scope:
    "Catalog synonyms and variant search, cart min/max/removal and noindex; all synthetic, no orders",
  externalNetworkBlocked: true,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
