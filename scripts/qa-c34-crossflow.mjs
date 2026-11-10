import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const location = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(location);
const origin = process.env.VONIX_C34_ORIGIN ?? "http://127.0.0.1:43976";
const folder = resolve("qa-artifacts/vonix-c34");
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 900 ? 900 : 844 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    let blockedExternal = 0;
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" || u.protocol === "data:") await route.continue();
      else {
        blockedExternal++;
        await route.abort();
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const result = { width, passed: false, blockedExternal, errors };
    try {
      const home = await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 25000 });
      if (home?.status() !== 200) throw Error("Home HTTP " + home?.status());
      await page.getByRole("heading", { name: "Explore do seu jeito" }).waitFor();
      await page.screenshot({ path: resolve(folder, "home-" + width + ".png") });
      await page.evaluate(() => sessionStorage.setItem("vonix-audience", JSON.stringify("casa")));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(950);
      const salon = page.locator('section[aria-labelledby="jornada-vonix"] a[href*="uso=salao"]');
      await salon.click();
      await page.waitForURL(
        (url) => url.pathname === "/loja" && url.searchParams.get("uso") === "salao",
        { timeout: 12000 },
      );
      await page.getByRole("heading", { level: 1, name: /Para Cabeleireiras/ }).waitFor();
      await page.waitForTimeout(900);
      const savedSalon = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("vonix-audience") || "null"),
      );
      if (savedSalon !== "salao") throw Error("Audience not updated: " + savedSalon);
      result.audienceOverride = true;
      await page.screenshot({ path: resolve(folder, "salon-" + width + ".png") });
      const product = await page.goto(origin + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (product?.status() !== 200) throw Error("Product HTTP " + product?.status());
      await page.getByRole("heading", { level: 1, name: /Kit Banana e Mel/ }).waitFor();
      await page.waitForTimeout(1300);
      await page.getByRole("button", { name: "Comprar agora" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Item adicionado" });
      await drawer.waitFor();
      const decrease = drawer.getByRole("button", { name: /Diminuir quantidade de/ }).first();
      const increase = drawer.getByRole("button", { name: /Aumentar quantidade de/ }).first();
      if (!(await decrease.isDisabled())) throw Error("Quantity 1 may be decremented to zero");
      if (await increase.isDisabled()) throw Error("Quantity increment disabled at 1");
      await page.waitForTimeout(700); // Wait for the drawer slide animation before measuring layout.
      const overlay = await page.evaluate(() => ({
        overflow: document.body.style.overflow,
        documentOverflow: document.documentElement.scrollWidth > innerWidth + 2,
        drawerOverflow:
          !!document.querySelector('[role="dialog"][aria-label="Item adicionado"]') &&
          document.querySelector('[role="dialog"][aria-label="Item adicionado"]').scrollWidth >
            innerWidth + 2,
        drawerSize: (() => {
          const d = document.querySelector('[role="dialog"][aria-label="Item adicionado"]');
          return { scrollWidth: d?.scrollWidth, clientWidth: d?.clientWidth };
        })(),
      }));
      if (overlay.overflow !== "hidden" || overlay.documentOverflow || overlay.drawerOverflow)
        throw Error("Drawer invalid " + JSON.stringify(overlay));
      result.drawerControlsAndScroll = true;
      await page.screenshot({ path: resolve(folder, "drawer-" + width + ".png") });
      await drawer.getByRole("button", { name: "Fechar" }).click();
      await drawer.waitFor({ state: "hidden" });
      if (await page.evaluate(() => document.body.style.overflow === "hidden"))
        throw Error("Background scroll remained locked");
      const cart = await page.goto(origin + "/carrinho", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (cart?.status() !== 200) throw Error("Cart HTTP " + cart?.status());
      await page.getByRole("heading", { level: 1, name: "Carrinho" }).waitFor();
      await page
        .getByText(/Kit Banana e Mel/i)
        .first()
        .waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2))
        throw Error("Cart horizontal overflow");
      result.cartPreserved = true;
      await page.screenshot({ path: resolve(folder, "cart-" + width + ".png") });
      if (errors.length) throw Error("JavaScript errors " + JSON.stringify(errors));
      result.passed = true;
    } catch (error) {
      result.error = String(error);
    } finally {
      result.blockedExternal = blockedExternal;
      results.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C34",
  environment: origin,
  scope:
    "Local Chrome with external blocked; simulated navigation and in-browser cart only; no checkout/payment",
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
