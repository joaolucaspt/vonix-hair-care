import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const origin = process.env.VONIX_C37_ORIGIN ?? "http://127.0.0.1:43981";
const dir = resolve("qa-artifacts/vonix-c37/nojs");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 900 ? 900 : 840 },
      javascriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (r) => {
      const u = new URL(r.request().url());
      return u.hostname === "127.0.0.1" || u.protocol === "data:" ? r.continue() : r.abort();
    });
    const page = await context.newPage();
    const state = { width, passed: false };
    try {
      const cart = await page.goto(origin + "/carrinho", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (cart?.status() !== 200) throw Error("Cart HTTP " + cart?.status());
      // Chromium DevTools "javascriptEnabled: false" retains raw <noscript>
      // parsing in this automation context. Verify SSR text and href, rather
      // than falsely claiming that the text was visually presented.
      const cartFallback = await page.locator("noscript").first().textContent();
      if (
        !cartFallback?.includes("Ative o JavaScript para conferir sua sacola") ||
        !cartFallback.includes('href="/loja"')
      )
        throw Error("Cart SSR missing actionable no-script fallback");
      state.cartFallback = "SSR noscript markup verified";
      await page.screenshot({ path: resolve(dir, "cart-" + width + ".png") });
      const checkout = await page.goto(origin + "/checkout", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (checkout?.status() !== 200) throw Error("Checkout HTTP " + checkout?.status());
      const checkoutFallback = await page.locator("noscript").first().textContent();
      if (
        !checkoutFallback?.includes("Ative o JavaScript para finalizar sua compra") ||
        !checkoutFallback.includes('href="/loja"')
      )
        throw Error("Checkout SSR missing actionable no-script fallback");
      state.checkoutFallback = "SSR noscript markup verified";
      await page.screenshot({ path: resolve(dir, "checkout-" + width + ".png") });
      const store = await page.goto(origin + "/loja", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (store?.status() !== 200) throw Error("Store HTTP " + store?.status());
      await page.getByRole("searchbox", { name: "Buscar na loja" }).waitFor({ timeout: 3000 });
      state.storeSearch = true;
      state.passed = true;
    } catch (e) {
      state.error = String(e).slice(0, 300);
    }
    results.push(state);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C37",
  mode: "Chrome JS disabled; verifies raw SSR noscript markup (not visual visibility), no external network",
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
