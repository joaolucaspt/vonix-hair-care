import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const playwrightLocation = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(playwrightLocation);
const origin = process.env.VONIX_C23_ORIGIN ?? "http://127.0.0.1:43972";
const folder = resolve(process.cwd(), "qa-artifacts/vonix-c23", process.env.VONIX_C23_PHASE ?? "dev");
await mkdir(folder, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 900 ? 840 : 844 },
      serviceWorkers: "block",
    });
    let blocked = 0;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.hostname === "127.0.0.1") await route.continue();
      else { blocked++; await route.abort(); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error.message)));
    const check = { width, passed: false, errors };
    try {
      const cat = await page.goto(origin + "/loja?categoria=kits", {
        waitUntil: "domcontentloaded", timeout: 20000,
      });
      if (cat?.status() !== 200) throw Error("Category HTTP " + cat?.status());
      await page.getByRole("heading", { level: 1, name: "Kits" }).waitFor();
      await page.getByRole("link", { name: "Remover filtro Categoria: Kits" }).waitFor();
      await page.getByRole("status").getByText("10 produtos").waitFor();
      check.categoryHeadingAndFilter = true;
      await page.screenshot({ path: resolve(folder, "category-" + width + ".png") });

      await page.goto(origin + "/loja?q=banana&categoria=quimica", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Nenhum produto encontrado." }).waitFor();
      await page.getByText(/Retire um filtro para ampliar a busca/).waitFor();
      await page.screenshot({ path: resolve(folder, "empty-filtered-" + width + ".png") });
      await page.waitForTimeout(1400); // SSR is not clickable until Vite dev hydration completes.
      await page.getByRole("link", { name: "Remover filtro Categoria: Química" }).click();
      await page.waitForURL((url) => url.searchParams.get("q") === "banana" && !url.searchParams.has("categoria"), { waitUntil: "domcontentloaded", timeout: 12000 });
      await page.getByText(/Kit Banana e Mel/i).first().waitFor();
      check.removeFilterKeepsSearch = true;
      await page.screenshot({ path: resolve(folder, "results-restored-" + width + ".png") });

      await page.goto(origin + "/loja?tiposProduto=tipo-invalido&ordem=nao-existe", { waitUntil: "domcontentloaded" });
      const invalidHeading = await page.locator("h1").first().innerText({ timeout: 5000 });
      check.invalidPageHeading = invalidHeading;
      if (!invalidHeading.includes("Todos os Produtos")) throw Error("Invalid filter heading: " + invalidHeading);
      await page.getByRole("status").getByText("42 produtos").waitFor({ timeout: 6500 });
      if (await page.getByRole("group", { name: "Filtros ativos" }).count())
        throw Error("Invalid filters advertised as active");
      check.invalidFilterRejected = true;

      await page.goto(origin + "/favoritos", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Sua lista de favoritos está vazia" }).waitFor();
      await page.getByRole("link", { name: "Explorar produtos" }).waitFor();
      check.emptyFavoritesDiscovery = true;
      await page.screenshot({ path: resolve(folder, "favorites-empty-" + width + ".png") });
      await page.evaluate(() => localStorage.setItem("vonix-favs", JSON.stringify(["kit-banana-e-mel"])));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("status").getByText(/1 produto salvo neste navegador/).waitFor();
      await page.getByText(/Kit Banana e Mel/i).first().waitFor();
      check.savedFavoritesCount = true;
      await page.screenshot({ path: resolve(folder, "favorites-saved-" + width + ".png") });

      await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
      const affiliateInvite = page.getByTestId("vonix-affiliate-home-invite");
      await affiliateInvite.waitFor({ timeout: 10000 });
      await affiliateInvite.getByRole("link", { name: /Conhecer o programa de afiliadas/ }).waitFor();
      await affiliateInvite.scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(folder, "affiliate-home-" + width + ".png") });
      const affiliateFooter = page.locator("footer").getByRole("link", { name: "Programa de afiliadas" });
      await affiliateFooter.waitFor();
      if (!(await affiliateFooter.getAttribute("href"))?.endsWith("/seja-afiliada"))
        throw Error("Footer affiliate destination lost after merge");
      if (width >= 1024) {
        const affiliateDesktop = page.getByRole("navigation", { name: "Categorias" })
          .getByRole("link", { name: "Seja afiliada" });
        await affiliateDesktop.waitFor({ state: "visible" });
      } else {
        await page.waitForTimeout(1200);
        await page.getByRole("button", { name: "Abrir menu" }).click();
        const affiliateMobile = page.locator('aside[aria-label="Menu rápido"]')
          .getByRole("link", { name: "Seja afiliada" });
        await affiliateMobile.waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: resolve(folder, "affiliate-menu-" + width + ".png") });
      }
      check.affiliateNavigationPreserved = true;

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow || errors.length) throw Error("Overflow or JS errors: " + JSON.stringify({ overflow, errors }));
      check.passed = true;
    } catch (error) {
      check.error = String(error);
    } finally {
      check.blockedExternal = blocked;
      results.push(check);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const report = {
  scope: "C23 showroom filters, no-result recovery and favorites empty/saved — synthetic Chrome only; no payments",
  date: "2026-11-10",
  origin,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
