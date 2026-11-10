import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const modulePath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(modulePath);
const origin = process.env.VONIX_C21_ORIGIN ?? "http://127.0.0.1:43972";
const output = resolve(cwd, "qa-artifacts/vonix-c21", process.env.VONIX_C21_LABEL ?? "dev");
const catalog = JSON.parse(await readFile(resolve(cwd, "src/data/products.json"), "utf8"));
const banana = catalog.find((item) => item.slug === "kit-banana-e-mel");
if (!banana?.variants?.[0]?.label) throw new Error("Missing synthetic catalog variant");
const item = { slug: banana.slug, variant: banana.variants[0].label };
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const outcomes = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 900 ? 820 : 844 },
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
    page.on("pageerror", (error) => errors.push(String(error.message)));
    const result = { width, passed: false, pageErrors: errors };
    try {
      await page.goto(origin + "/favoritos", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("heading", { name: "Favoritos" }).waitFor();
      await page.evaluate(() => localStorage.setItem("vonix-favs", JSON.stringify({ corrupted: true })));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText(/você ainda não favoritou produtos/i).waitFor({ timeout: 9000 });
      result.corruptFavoritesRecovered = true;

      const otherTab = await context.newPage();
      await otherTab.goto(origin + "/loja", { waitUntil: "domcontentloaded", timeout: 20000 });
      await otherTab.waitForTimeout(1200);
      await otherTab.evaluate(() => {
        localStorage.setItem("vonix-favs", JSON.stringify([
          "kit-banana-e-mel", "plex-vonix", "kit-banana-e-mel",
        ]));
      });
      await page.getByText(/banana e mel/i).first().waitFor({ timeout: 9500 });
      if (await page.getByText(/plex vonix/i).count()) throw new Error("Retired favorite reappeared");
      result.crossTabFavoritesSync = true;
      await page.screenshot({ path: resolve(output, "favorites-" + width + ".png") });

      await page.goto(origin + "/carrinho", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Carrinho" }).waitFor();
      await page.getByText(/seu carrinho está vazio/i).waitFor({ timeout: 10000 });
      await otherTab.evaluate((line) => {
        localStorage.setItem("vonix-cart", JSON.stringify([{ ...line, qty: 2 }]));
      }, item);
      const plus = page.getByRole("button", { name: /Aumentar quantidade de .*Banana e Mel/i }).first();
      await plus.waitFor({ timeout: 10000 });
      result.cartAddedFromOtherTab = true;
      await otherTab.evaluate((line) => {
        localStorage.setItem("vonix-cart", JSON.stringify([{ ...line, qty: 3 }]));
      }, item);
      await page.waitForFunction(() => {
        const button = Array.from(document.querySelectorAll("button")).find((node) =>
          node.getAttribute("aria-label")?.includes("Aumentar quantidade de") &&
          node.getAttribute("aria-label")?.includes("Banana e Mel"),
        );
        return button?.parentElement?.querySelector("span")?.textContent?.trim() === "3";
      }, null, { timeout: 10000 });
      result.crossTabQuantity3 = true;
      await page.screenshot({ path: resolve(output, "cart-" + width + ".png") });

      await page.goto(origin + "/loja?q=mascara", { waitUntil: "domcontentloaded" });
      await page.getByText(/Máscara Efeito Teia C[oô]co Nutri/i).first().waitFor({ timeout: 10000 });
      result.accentFreeMaskSearch = true;
      await page.goto(origin + "/loja?q=cafe%20verde", { waitUntil: "domcontentloaded" });
      await page.getByText(/Kit Café Verde/i).first().waitFor({ timeout: 10000 });
      result.accentFreeCafeSearch = true;
      await page.goto(origin + "/loja?tiposProduto=Combos", { waitUntil: "domcontentloaded" });
      await page.getByText(/Kit Banana e Mel/i).first().waitFor({ timeout: 10000 });
      if (await page.getByText(/Não encontramos produtos/i).count())
        throw new Error("Legacy Combos bookmark no longer displays Kits");
      result.legacyCombosFilterCompatible = true;
      await page.screenshot({ path: resolve(output, "search-" + width + ".png") });

      await page.goto(origin + "/checkout", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /Finalizar compra/i }).waitFor();
      const summary = page.getByTestId("summary");
      await summary.waitFor();
      const totalBefore = await summary.textContent();
      await otherTab.evaluate((line) => {
        localStorage.setItem("vonix-cart", JSON.stringify([{ ...line, qty: 1 }]));
      }, item);
      await page.waitForFunction((before) =>
        document.querySelector('[data-testid="summary"]')?.textContent !== before,
      totalBefore, { timeout: 9500 });
      const pay = page.getByRole("button", { name: /Gerar Pix/ });
      if (await pay.isEnabled()) throw new Error("Checkout payment enabled without CEP quote");
      result.checkoutRecomputedWithoutPayment = true;
      await page.screenshot({ path: resolve(output, "checkout-" + width + ".png") });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow || errors.length) throw new Error("Overflow or JS errors: " + JSON.stringify({ overflow, errors }));
      result.passed = true;
    } catch (error) {
      result.error = String(error);
    } finally {
      result.externalBlocked = externalBlocked;
      outcomes.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  date: "2026-11-09",
  scope: "C21 synthetic corrupted favorites, cross-tab cart/favorites and accent search; no payments or external network",
  origin,
  outcomes,
  passed: outcomes.filter((item) => item.passed).length,
  failed: outcomes.filter((item) => !item.passed).length,
};
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
