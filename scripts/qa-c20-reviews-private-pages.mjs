import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const modulePath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(modulePath);
const base = process.env.VONIX_C20_ORIGIN ?? "http://127.0.0.1:43972";
const output = resolve(process.cwd(), "qa-artifacts/vonix-c20", process.env.VONIX_C20_LABEL ?? "dev");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const outcomes = [];
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
    await context.addInitScript(() => {
      if (location.pathname === "/conta") {
        sessionStorage.setItem("vonix-card-verification-v1", JSON.stringify({
          orderId: 709,
          statusToken: "synthetic-audit-token-never-real",
          total: 100,
          paid: true,
          status: "aprovado",
          savedAt: Date.now(),
        }));
      }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error.message)));
    const result = { width, passed: false, pageErrors, externalBlocked: 0 };
    try {
      const account = await page.goto(base + "/conta", { waitUntil: "domcontentloaded", timeout: 18000 });
      if (account?.status() !== 200) throw new Error("Account HTTP " + account?.status());
      await page.getByRole("heading", { name: "Meus pedidos" }).waitFor();
      await page.getByText("Pedido nº 709").waitFor({ timeout: 9000 });
      const robotsAccount = await page.locator('meta[name="robots"]').getAttribute("content");
      if (robotsAccount !== "noindex, nofollow") throw new Error("Account robots policy " + robotsAccount);
      if ((await page.content()).includes("synthetic-audit-token-never-real")) throw new Error("Status token leaked to DOM");
      if (await page.getByText(/Pagamento confirmado pela Appmax/).count()) throw new Error("Unverified local paid status advertised");
      result.accountStatusIsUnverified = true;
      result.accountNoindex = true;
      await page.screenshot({ path: resolve(output, "account-" + width + ".png") });

      const favorites = await page.goto(base + "/favoritos", { waitUntil: "domcontentloaded", timeout: 18000 });
      if (favorites?.status() !== 200) throw new Error("Favorites HTTP " + favorites?.status());
      await page.getByRole("heading", { name: "Favoritos" }).waitFor();
      const robotsFavorites = await page.locator('meta[name="robots"]').getAttribute("content");
      if (robotsFavorites !== "noindex, nofollow") throw new Error("Favorites robots policy " + robotsFavorites);
      result.favoritesNoindex = true;
      await page.screenshot({ path: resolve(output, "favorites-" + width + ".png") });

      const product = await page.goto(base + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 18000,
      });
      if (product?.status() !== 200) throw new Error("Product HTTP " + product?.status());
      await page.getByRole("heading", { name: /banana e mel/i }).first().waitFor();
      const reviewForm = page.getByRole("form", { name: /Avaliar .*Banana/i });
      await reviewForm.waitFor({ state: "visible", timeout: 10000 });
      await reviewForm.getByRole("radio", { name: "5 estrelas" }).click();
      await reviewForm.getByPlaceholder("Como você quer aparecer").fill("Visitante QA sem envio");
      if ((await reviewForm.getByPlaceholder("Como você quer aparecer").inputValue()) !== "Visitante QA sem envio") {
        throw new Error("Review field did not accept synthetic draft");
      }
      result.reviewDraftWithoutSubmit = true;
      await page.screenshot({ path: resolve(output, "review-" + width + ".png") });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow || pageErrors.length) throw new Error("Overflow / browser JS: " + JSON.stringify({ overflow, pageErrors }));
      result.passed = true;
      result.externalBlocked = externalBlocked;
    } catch (error) {
      result.error = String(error);
    } finally {
      outcomes.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  date: "2026-11-09",
  scope: "C20 synthetic account/favorites privacy and review draft, no submissions; all external requests blocked",
  base,
  outcomes,
  passed: outcomes.filter((item) => item.passed).length,
  failed: outcomes.filter((item) => !item.passed).length,
};
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
