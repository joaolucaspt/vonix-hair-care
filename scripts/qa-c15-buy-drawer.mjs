import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const root = process.cwd();
const modulePath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(modulePath);
const base = process.env.VONIX_C15_ORIGIN ?? "http://127.0.0.1:43972";
const output = resolve(root, "qa-artifacts/vonix-c15", process.env.VONIX_C15_LABEL ?? "dev");
await mkdir(output, { recursive: true });
const outcomes = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 900 ? 820 : 844 },
      serviceWorkers: "block",
    });
    let externalBlocked = 0;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.hostname === "127.0.0.1") {
        await route.continue();
      } else {
        externalBlocked += 1;
        await route.abort();
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    const step = { viewport: width, passed: false, pageErrors: errors, externalBlocked };
    try {
      const product = await page.goto(base + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (product?.status() !== 200) throw new Error("PDP HTTP " + product?.status());
      await page.getByRole("heading", { name: /banana e mel/i }).first().waitFor();
      await page.waitForTimeout(1600); // dev hydration; do not trigger a payment API.
      if (width === 320) {
        await page.getByRole("button", { name: "Recusar opcionais" }).click();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1100);
      }
      const buyButton = width === 320
        ? page.getByRole("button", { name: "Comprar agora" }).last()
        : page.getByRole("button", { name: "Comprar agora" }).first();
      await buyButton.click({ timeout: 8000 });
      const drawer = page.getByRole("dialog", { name: "Item adicionado" });
      await drawer.waitFor({ state: "visible", timeout: 8000 });
      const content = await drawer.innerText();
      if (!content.includes("Disponibilidade, valor e prazo sujeitos à cotação do CEP")) {
        throw new Error("Shipping quote qualification missing");
      }
      if (content.includes("Você ganhou frete grátis!")) {
        throw new Error("Unverified free shipping promise");
      }
      const quantity = drawer.getByRole("button", { name: /Aumentar quantidade de/ }).first();
      await quantity.click();
      await page.screenshot({ path: resolve(output, "drawer-" + width + ".png") });
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden", timeout: 4000 });
      await buyButton.click({ timeout: 8000 });
      await drawer.waitFor({ state: "visible", timeout: 4000 });
      await drawer.getByRole("button", { name: /Ir para o pagamento/ }).click({ timeout: 8000 });
      await page.waitForURL("**/checkout", { timeout: 12000 });
      await page.getByRole("heading", { name: /Finalizar compra/i }).waitFor();
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cartStored: !!localStorage.getItem("vonix-cart"),
      }));
      if (metrics.overflow || !metrics.cartStored || errors.length) {
        throw new Error("Layout/cart/errors " + JSON.stringify({ metrics, errors }));
      }
      await page.screenshot({ path: resolve(output, "checkout-" + width + ".png") });
      step.passed = true;
      step.metrics = metrics;
      step.externalBlocked = externalBlocked;
    } catch (err) {
      step.error = String(err);
    } finally {
      outcomes.push(step);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  scope: "local dev SSR and synthetic browser, no payment",
  date: "2026-11-09",
  origin: base,
  outcomes,
  passed: outcomes.filter((x) => x.passed).length,
  failed: outcomes.filter((x) => !x.passed).length,
};
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
